import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../db';
import { streamNotifications } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Note: To use this properly, you'll need to set up API credentials for each platform
// For now, this is a basic structure. You'll need to:
// 1. Register apps with Twitch, YouTube, and Kick
// 2. Add API keys to your .env file
// 3. Implement the actual API calls

interface StreamData {
  isLive: boolean;
  title?: string;
  game?: string;
  viewers?: number;
  thumbnailUrl?: string;
  streamUrl?: string;
}

export class StreamMonitor {
  private client: Client;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

  constructor(client: Client) {
    this.client = client;
  }

  start() {
    console.log('🔍 Starting stream monitor...');
    
    // Run initial check
    this.checkAllStreams();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllStreams();
    }, this.CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Stream monitor stopped');
    }
  }

  private async checkAllStreams() {
    try {
      const streams = await db
        .select()
        .from(streamNotifications)
        .where(eq(streamNotifications.isActive, true));

      console.log(`🔍 Checking ${streams.length} stream(s)...`);

      for (const stream of streams) {
        await this.checkStream(stream);
      }
    } catch (error) {
      console.error('Error checking streams:', error);
    }
  }

  private async checkStream(stream: typeof streamNotifications.$inferSelect) {
    try {
      let streamData: StreamData | null = null;

      // Check based on platform
      switch (stream.platform) {
        case 'twitch':
          streamData = await this.checkTwitch(stream.username);
          break;
        case 'youtube':
          streamData = await this.checkYouTube(stream.username);
          break;
        case 'kick':
          streamData = await this.checkKick(stream.username);
          break;
      }

      if (!streamData) {
        return;
      }

      // Check if status changed
      const wasLive = stream.isLive;
      const isNowLive = streamData.isLive;

      if (!wasLive && isNowLive) {
        // Stream just went live!
        await this.sendLiveNotification(stream, streamData);
        
        // Update database
        await db
          .update(streamNotifications)
          .set({
            isLive: true,
            liveTitle: streamData.title,
            liveGame: streamData.game,
            liveViewers: streamData.viewers,
            liveStartedAt: new Date(),
            lastChecked: new Date(),
          })
          .where(eq(streamNotifications.id, stream.id));
          
      } else if (wasLive && !isNowLive) {
        // Stream went offline
        await this.updateOfflineStatus(stream);
        
        // Update database
        await db
          .update(streamNotifications)
          .set({
            isLive: false,
            liveTitle: null,
            liveGame: null,
            liveViewers: null,
            lastChecked: new Date(),
          })
          .where(eq(streamNotifications.id, stream.id));
          
      } else if (wasLive && isNowLive) {
        // Stream still live, update stats
        await db
          .update(streamNotifications)
          .set({
            liveTitle: streamData.title,
            liveGame: streamData.game,
            liveViewers: streamData.viewers,
            lastChecked: new Date(),
          })
          .where(eq(streamNotifications.id, stream.id));
      } else {
        // Still offline, just update check time
        await db
          .update(streamNotifications)
          .set({
            lastChecked: new Date(),
          })
          .where(eq(streamNotifications.id, stream.id));
      }
    } catch (error) {
      console.error(`Error checking ${stream.platform}/${stream.username}:`, error);
    }
  }

  private async sendLiveNotification(
    stream: typeof streamNotifications.$inferSelect,
    streamData: StreamData
  ) {
    try {
      const channel = await this.client.channels.fetch(stream.channelId) as TextChannel;
      if (!channel) return;

      const platformEmoji = {
        twitch: '🟣',
        youtube: '🔴',
        kick: '🟢',
      }[stream.platform] || '📺';

      const streamUrl = streamData.streamUrl || this.getStreamUrl(stream.platform, stream.username);

      const embed = new EmbedBuilder()
        .setColor(this.getPlatformColor(stream.platform))
        .setTitle(`${platformEmoji} ${stream.displayName || stream.username} is now LIVE!`)
        .setURL(streamUrl)
        .setDescription(streamData.title || 'No title')
        .setTimestamp();

      if (streamData.game) {
        embed.addFields({ name: '🎮 Playing', value: streamData.game, inline: true });
      }

      if (streamData.viewers !== undefined) {
        embed.addFields({ name: '👥 Viewers', value: streamData.viewers.toString(), inline: true });
      }

      embed.addFields({ name: '🔗 Watch', value: `[Click here to watch](${streamUrl})`, inline: true });

      if (streamData.thumbnailUrl) {
        embed.setImage(streamData.thumbnailUrl);
      }

      if (stream.avatarUrl) {
        embed.setThumbnail(stream.avatarUrl);
      }

      embed.setFooter({ text: `${stream.platform.charAt(0).toUpperCase() + stream.platform.slice(1)} • Started streaming` });

      let content = stream.notificationMessage || `${stream.username} is live!`;
      
      // Add role ping if configured
      if (stream.roleIdToPing) {
        content = `<@&${stream.roleIdToPing}> ${content}`;
      }

      const message = await channel.send({
        content,
        embeds: [embed],
      });

      // Save message ID for potential updates
      await db
        .update(streamNotifications)
        .set({ messageId: message.id })
        .where(eq(streamNotifications.id, stream.id));

    } catch (error) {
      console.error('Error sending live notification:', error);
    }
  }

  private async updateOfflineStatus(stream: typeof streamNotifications.$inferSelect) {
    // Optionally delete or update the live notification message
    if (stream.messageId) {
      try {
        const channel = await this.client.channels.fetch(stream.channelId) as TextChannel;
        if (channel) {
          const message = await channel.messages.fetch(stream.messageId);
          // You can choose to delete it or edit it to say "Stream ended"
          // await message.delete();
          
          const embed = EmbedBuilder.from(message.embeds[0])
            .setColor(0x95A5A6)
            .setFooter({ text: 'Stream Ended' });
          
          await message.edit({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error updating offline status:', error);
      }
    }
  }

  private async checkTwitch(username: string): Promise<StreamData | null> {
    // TODO: Implement Twitch API check
    // You'll need to:
    // 1. Register app at https://dev.twitch.tv/
    // 2. Get Client ID and Secret
    // 3. Use Twitch Helix API: GET https://api.twitch.tv/helix/streams?user_login={username}
    
    console.log(`[Twitch] Checking ${username} (API not implemented)`);
    return null;
  }

  private async checkYouTube(username: string): Promise<StreamData | null> {
    // TODO: Implement YouTube API check
    // You'll need to:
    // 1. Create project in Google Cloud Console
    // 2. Enable YouTube Data API v3
    // 3. Get API key
    // 4. Use endpoint: GET https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={channelId}&eventType=live&type=video
    
    console.log(`[YouTube] Checking ${username} (API not implemented)`);
    return null;
  }

  private async checkKick(username: string): Promise<StreamData | null> {
    // TODO: Implement Kick API check
    // Kick has a public API: GET https://kick.com/api/v2/channels/{username}
    
    try {
      const response = await fetch(`https://kick.com/api/v2/channels/${username}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.livestream) {
        return {
          isLive: true,
          title: data.livestream.session_title,
          game: data.livestream.categories?.[0]?.name,
          viewers: data.livestream.viewer_count,
          thumbnailUrl: data.livestream.thumbnail?.url,
          streamUrl: `https://kick.com/${username}`,
        };
      }

      return { isLive: false };
    } catch (error) {
      console.error(`Error checking Kick for ${username}:`, error);
      return null;
    }
  }

  private getStreamUrl(platform: string, username: string): string {
    const urls = {
      twitch: `https://twitch.tv/${username}`,
      youtube: `https://youtube.com/@${username}/live`,
      kick: `https://kick.com/${username}`,
    };
    return urls[platform as keyof typeof urls] || '';
  }

  private getPlatformColor(platform: string): number {
    const colors = {
      twitch: 0x9146FF,
      youtube: 0xFF0000,
      kick: 0x53FC18,
    };
    return colors[platform as keyof typeof colors] || 0x9B59B6;
  }
}
