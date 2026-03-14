import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../db';
import { streamNotifications } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { info, debug, error } from '../utils/logger';
import { TwitchAPI } from '../utils/twitchAPI';
import { YouTubeAPI } from '../utils/youtubeAPI';

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
  private readonly twitch = new TwitchAPI();
  private readonly youtube = new YouTubeAPI();

  constructor(client: Client) {
    this.client = client;
  }

  start() {
    info('🔍 Starting stream monitor...');
    
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
      info('⏹️ Stream monitor stopped');
    }
  }

  private async checkAllStreams() {
    try {
      const streams = await db
        .select()
        .from(streamNotifications)
        .where(eq(streamNotifications.isActive, true));

  debug(`🔍 Checking ${streams.length} stream(s)...`);

      for (const stream of streams) {
        await this.checkStream(stream);
      }
    } catch (err) {
      error('Error checking streams:', err);
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
    } catch (err) {
      error(`Error checking ${stream.platform}/${stream.username}:`, err);
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

    } catch (err) {
      error('Error sending live notification:', err);
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
      } catch (err) {
        error('Error updating offline status:', err);
      }
    }
  }

  private async checkTwitch(username: string): Promise<StreamData | null> {
    debug(`[Twitch] Checking ${username}`);
    return this.twitch.getStreamData(username);
  }

  private async checkYouTube(channelId: string): Promise<StreamData | null> {
    debug(`[YouTube] Checking ${channelId}`);
    return this.youtube.getStreamData(channelId);
  }

  private async checkKick(username: string): Promise<StreamData | null> {
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
    } catch (err) {
      error(`Error checking Kick for ${username}:`, err);
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
