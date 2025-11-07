/**
 * Social Media API Integration
 * Supports BlueSky, Instagram, and X (Twitter)
 */

import { info, warn, error, debug } from './logger';

interface SocialPost {
  id: string;
  author: string;
  authorHandle: string;
  authorAvatar?: string;
  content: string;
  timestamp: Date;
  likes: number;
  reposts?: number;
  replies?: number;
  url: string;
  platform: 'bluesky' | 'instagram' | 'x';
  media?: {
    type: 'image' | 'video' | 'gif';
    url: string;
  }[];
}

interface SocialMediaCredentials {
  bluesky?: {
    handle: string;
    password?: string;
  };
  instagram?: {
    username: string;
    sessionId?: string;
  };
  x?: {
    bearerToken: string;
  };
}

class SocialMediaAPI {
  private blueskyPDS = 'https://bsky.social';
  private xAPIUrl = 'https://api.twitter.com/2';
  private instagramAPIUrl = 'https://graph.instagram.com/v18.0';

  /**
   * Get recent posts from a BlueSky account
   */
  async getBlueskyPosts(handle: string, limit: number = 10): Promise<SocialPost[]> {
    try {
      const cleanHandle = handle.replace('@', '').toLowerCase();
      
      // BlueSky API endpoint for getting posts
      const response = await fetch(
        `${this.blueskyPDS}/xrpc/app.bsky.feed.getAuthorFeed?actor=${cleanHandle}&limit=${Math.min(limit, 100)}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        error(`❌ BlueSky API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as any;
      const posts: SocialPost[] = [];

      if (data.feed && Array.isArray(data.feed)) {
        for (const item of data.feed.slice(0, limit)) {
          const post = item.post;
          
          posts.push({
            id: post.uri,
            author: post.author.displayName || post.author.handle,
            authorHandle: post.author.handle,
            authorAvatar: post.author.avatar,
            content: post.record?.text || '',
            timestamp: new Date(post.record?.createdAt || new Date()),
            likes: post.likeCount || 0,
            reposts: post.repostCount || 0,
            replies: post.replyCount || 0,
            url: `https://bsky.app/profile/${post.author.did}/post/${post.uri.split('/').pop()}`,
            platform: 'bluesky',
            media: this.extractBlueskyMedia(post)
          });
        }
      }

      info(`✅ Retrieved ${posts.length} BlueSky posts from @${cleanHandle}`);
      return posts;
    } catch (err) {
      error('❌ Error fetching BlueSky posts:', err);
      return [];
    }
  }

  /**
   * Get recent posts from an X (Twitter) account
   */
  async getXPosts(username: string, limit: number = 10): Promise<SocialPost[]> {
    try {
      const bearerToken = process.env.X_API_KEY;
      if (!bearerToken) {
        warn('⚠️  X_API_KEY not set in environment');
        return [];
      }

      const cleanUsername = username.replace('@', '').toLowerCase();

      // First, get the user ID
      const userResponse = await fetch(
        `${this.xAPIUrl}/users/by/username/${cleanUsername}`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'User-Agent': 'TeraBot/1.0'
          }
        }
      );

      if (!userResponse.ok) {
        error(`❌ X API error (user lookup): ${userResponse.status}`);
        return [];
      }

      const userData = await userResponse.json() as any;
      const userId = userData.data?.id;

      if (!userId) {
        error(`❌ Could not find X user: ${cleanUsername}`);
        return [];
      }

      // Get user's recent tweets
      const tweetsResponse = await fetch(
        `${this.xAPIUrl}/users/${userId}/tweets?max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics,author_id&media.fields=media_key,type,url&expansions=author_id,attachments.media_keys&user.fields=username,name,profile_image_url`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'User-Agent': 'TeraBot/1.0'
          }
        }
      );

      if (!tweetsResponse.ok) {
        error(`❌ X API error (tweets): ${tweetsResponse.status}`);
        return [];
      }

      const tweetsData = await tweetsResponse.json() as any;
      const posts: SocialPost[] = [];

      if (tweetsData.data && Array.isArray(tweetsData.data)) {
        for (const tweet of tweetsData.data.slice(0, limit)) {
          posts.push({
            id: tweet.id,
            author: userData.data.name,
            authorHandle: userData.data.username,
            authorAvatar: userData.data.profile_image_url,
            content: tweet.text || '',
            timestamp: new Date(tweet.created_at),
            likes: tweet.public_metrics?.like_count || 0,
            reposts: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0,
            url: `https://x.com/${userData.data.username}/status/${tweet.id}`,
            platform: 'x',
            media: this.extractXMedia(tweetsData.includes?.media, tweet.attachments?.media_keys)
          });
        }
      }

      info(`✅ Retrieved ${posts.length} X posts from @${cleanUsername}`);
      return posts;
    } catch (err) {
      error('❌ Error fetching X posts:', err);
      return [];
    }
  }

  /**
   * Get recent posts from an Instagram account
   * Note: Requires Instagram Graph API token
   */
  async getInstagramPosts(username: string, limit: number = 10): Promise<SocialPost[]> {
    try {
      const igToken = process.env.INSTAGRAM_API_TOKEN;
      if (!igToken) {
        warn('⚠️  INSTAGRAM_API_TOKEN not set in environment');
        return [];
      }

      // This endpoint requires a business account and proper setup
      // For now, we'll return a placeholder that explains the setup
      warn('⚠️  Instagram API requires business account and manual setup');
      
      // In a production environment, you would:
      // 1. Get the Instagram Business Account ID via Graph API
      // 2. Fetch media using /ig_business_account/media endpoint
      // 3. Parse media data and return posts

      return [];
    } catch (err) {
      error('❌ Error fetching Instagram posts:', err);
      return [];
    }
  }

  /**
   * Format a social media post for Discord embed
   */
  formatPostForDiscord(post: SocialPost): { title: string; description: string; url: string; thumbnail?: string } {
    const platformEmoji = {
      bluesky: '🦋',
      instagram: '📸',
      x: '𝕏'
    };

    const emoji = platformEmoji[post.platform];
    const timeDiff = this.getTimeDifference(post.timestamp);

    return {
      title: `${emoji} ${post.author} (@${post.authorHandle})`,
      description: `${post.content.substring(0, 1024)}\n\n` +
                  `❤️ ${post.likes.toLocaleString()} • ` +
                  `🔄 ${post.reposts || 0} • ` +
                  `💬 ${post.replies || 0}\n\n` +
                  `_${timeDiff}_`,
      url: post.url,
      thumbnail: post.authorAvatar
    };
  }

  /**
   * Get multiple platforms' posts for a user
   */
  async getMultiplePlatformPosts(
    blueskyHandle?: string,
    xHandle?: string,
    instagramUsername?: string,
    limit: number = 5
  ): Promise<{ [key: string]: SocialPost[] }> {
    const results: { [key: string]: SocialPost[] } = {};

    const [blueskyPosts, xPosts, instagramPosts] = await Promise.all([
      blueskyHandle ? this.getBlueskyPosts(blueskyHandle, limit) : Promise.resolve([]),
      xHandle ? this.getXPosts(xHandle, limit) : Promise.resolve([]),
      instagramUsername ? this.getInstagramPosts(instagramUsername, limit) : Promise.resolve([])
    ]);

    if (blueskyPosts.length > 0) results.bluesky = blueskyPosts;
    if (xPosts.length > 0) results.x = xPosts;
    if (instagramPosts.length > 0) results.instagram = instagramPosts;

    return results;
  }

  /**
   * Extract media from BlueSky posts
   */
  private extractBlueskyMedia(post: any) {
    const media = [];
    if (post.embed?.images) {
      for (const img of post.embed.images) {
        media.push({
          type: 'image' as const,
          url: img.fullsize || img.thumb
        });
      }
    }
    if (post.embed?.video) {
      media.push({
        type: 'video' as const,
        url: post.embed.video.thumbnail
      });
    }
    return media.length > 0 ? media : undefined;
  }

  /**
   * Extract media from X tweets
   */
  private extractXMedia(mediaData: any[], mediaKeys?: string[]) {
    if (!mediaData || !mediaKeys) return undefined;

    const media = [];
    for (const key of mediaKeys) {
      const mediaItem = mediaData.find((m: any) => m.media_key === key);
      if (mediaItem) {
        media.push({
          type: (mediaItem.type === 'photo' ? 'image' : mediaItem.type) as 'image' | 'video' | 'gif',
          url: mediaItem.url || mediaItem.preview_image_url
        });
      }
    }
    return media.length > 0 ? media : undefined;
  }

  /**
   * Get human-readable time difference
   */
  private getTimeDifference(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}

export const socialMediaAPI = new SocialMediaAPI();
export type { SocialPost, SocialMediaCredentials };
