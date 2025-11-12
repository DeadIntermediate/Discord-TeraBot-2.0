/**
 * Live Status Monitor
 * Creates and manages live monitoring channels for bot statistics
 */

import { Client, TextChannel, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { info, error, debug } from './logger';

// Configuration
const MONITORING_GUILD_ID = '1431645643746836532'; // Only monitor this specific guild
const MONITORING_CATEGORY_ID = '1431655183783559239';
const XP_LOG_CHANNEL_NAME = '📊-xp-activity';
const STATUS_CHANNEL_NAME = '🤖-bot-status';

// Channel update intervals (in milliseconds)
const XP_LOG_BATCH_INTERVAL = 5000; // Send batched XP logs every 5 seconds
const STATUS_UPDATE_INTERVAL = 60000; // Update status every 60 seconds

// XP log queue for batching
interface XPLogEntry {
  guildId: string;
  userId: string;
  username: string;
  xpGained: number;
  xpType: 'voice' | 'text' | 'stream';
  newLevel?: number | undefined;
  timestamp: Date;
}

class LiveMonitor {
  private client: Client | null = null;
  private xpLogQueue: Map<string, XPLogEntry[]> = new Map(); // guildId -> entries
  private monitoringChannels: Map<string, { xpLog?: string; status?: string }> = new Map(); // guildId -> channel IDs
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private xpBatchInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the live monitor
   */
  async initialize(client: Client) {
    this.client = client;
    info('🔴 [LiveMonitor] Initializing live status monitoring...');

    // Set up monitoring channels only for the specified guild
    await this.setupMonitoringChannels(MONITORING_GUILD_ID);
    const guild = client.guilds.cache.get(MONITORING_GUILD_ID);
    if (guild) {
      info(`🔴 [LiveMonitor] Monitoring enabled for guild: ${guild.name}`);
    }

    // Start periodic status updates
    this.startStatusUpdates();
    
    // Start XP log batching
    this.startXPLogBatching();

    info('✅ [LiveMonitor] Live monitoring initialized');
  }

  /**
   * Set up monitoring channels in a guild
   */
  async setupMonitoringChannels(guildId: string) {
    try {
      const guild = this.client?.guilds.cache.get(guildId);
      if (!guild) {
        error(`[LiveMonitor] Guild ${guildId} not found`);
        return;
      }

      // Check if category exists, create if not
      let category = guild.channels.cache.get(MONITORING_CATEGORY_ID);
      
      // If the specific category doesn't exist, find or create a "Tera Bot Monitor" category
      if (!category || category.type !== ChannelType.GuildCategory) {
        // Try to find existing monitoring category by name
        category = guild.channels.cache.find(
          ch => ch.type === ChannelType.GuildCategory && ch.name === '📊 Tera Bot Monitor'
        );
        
        // Create category if it doesn't exist
        if (!category) {
          category = await guild.channels.create({
            name: '📊 Tera Bot Monitor',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                allow: [PermissionFlagsBits.ViewChannel]
              }
            ]
          });
          info(`✅ [LiveMonitor] Created monitoring category in ${guild.name}`);
        }
      }

      const channels: { xpLog?: string; status?: string } = {};

      // Find or create XP log channel
      let xpLogChannel = guild.channels.cache.find(
        ch => ch.name === XP_LOG_CHANNEL_NAME && ch.parentId === category!.id
      ) as TextChannel;

      if (!xpLogChannel) {
        xpLogChannel = await guild.channels.create({
          name: XP_LOG_CHANNEL_NAME,
          type: ChannelType.GuildText,
          parent: category!.id,
          topic: '📊 Live XP activity feed - Real-time member XP gains',
          permissionOverwrites: [
            {
              id: guild.id, // @everyone
              deny: [PermissionFlagsBits.SendMessages],
              allow: [PermissionFlagsBits.ViewChannel]
            }
          ]
        });
        info(`✅ [LiveMonitor] Created XP log channel in ${guild.name}`);
      }
      channels.xpLog = xpLogChannel.id;

      // Find or create status channel
      let statusChannel = guild.channels.cache.find(
        ch => ch.name === STATUS_CHANNEL_NAME && ch.parentId === category!.id
      ) as TextChannel;

      if (!statusChannel) {
        statusChannel = await guild.channels.create({
          name: STATUS_CHANNEL_NAME,
          type: ChannelType.GuildText,
          parent: category!.id,
          topic: '🤖 Live bot statistics and status',
          permissionOverwrites: [
            {
              id: guild.id, // @everyone
              deny: [PermissionFlagsBits.SendMessages],
              allow: [PermissionFlagsBits.ViewChannel]
            }
          ]
        });
        info(`✅ [LiveMonitor] Created status channel in ${guild.name}`);
        
        // Send initial status message
        await this.updateStatusChannel(guildId, statusChannel);
      }
      channels.status = statusChannel.id;

      this.monitoringChannels.set(guildId, channels);
      info(`📡 [LiveMonitor] Monitoring channels ready for ${guild.name}`);

    } catch (err) {
      error(`[LiveMonitor] Error setting up monitoring channels in guild ${guildId}:`, err);
    }
  }

  /**
   * Log XP gain event (queued for batching)
   */
  logXPGain(
    guildId: string,
    userId: string,
    username: string,
    xpGained: number,
    xpType: 'voice' | 'text' | 'stream',
    newLevel?: number
  ) {
    // Only log XP for the monitored guild
    if (guildId !== MONITORING_GUILD_ID) {
      return;
    }

    debug(`📊 [LiveMonitor] Queuing XP: ${username} +${xpGained} ${xpType} XP${newLevel ? ` (Level ${newLevel}!)` : ''}`);

    const entry: XPLogEntry = {
      guildId,
      userId,
      username,
      xpGained,
      xpType,
      newLevel,
      timestamp: new Date()
    };

    // Add to queue
    const queue = this.xpLogQueue.get(guildId) || [];
    queue.push(entry);
    this.xpLogQueue.set(guildId, queue);
    
    debug(`📊 [LiveMonitor] Queue size for guild ${guildId}: ${queue.length}`);
  }

  /**
   * Start batched XP log processing
   */
  private startXPLogBatching() {
    this.xpBatchInterval = setInterval(async () => {
      for (const [guildId, entries] of this.xpLogQueue.entries()) {
        if (entries.length === 0) continue;

        debug(`📤 [LiveMonitor] Sending ${entries.length} batched XP logs for guild ${guildId}`);
        
        try {
          await this.sendBatchedXPLogs(guildId, entries);
          this.xpLogQueue.set(guildId, []); // Clear queue
        } catch (err) {
          error(`[LiveMonitor] Error sending batched XP logs for guild ${guildId}:`, err);
        }
      }
    }, XP_LOG_BATCH_INTERVAL);
  }

  /**
   * Send batched XP logs to channel
   */
  private async sendBatchedXPLogs(guildId: string, entries: XPLogEntry[]) {
    const channelIds = this.monitoringChannels.get(guildId);
    if (!channelIds?.xpLog) return;

    const channel = this.client?.channels.cache.get(channelIds.xpLog) as TextChannel;
    if (!channel) return;

    // Group entries by type
    const voiceEntries = entries.filter(e => e.xpType === 'voice' || e.xpType === 'stream');
    const textEntries = entries.filter(e => e.xpType === 'text');
    const levelUps = entries.filter(e => e.newLevel);

    const embeds: EmbedBuilder[] = [];

    // Voice XP summary
    if (voiceEntries.length > 0) {
      const totalVoiceXP = voiceEntries.reduce((sum, e) => sum + e.xpGained, 0);
      const uniqueUsers = new Set(voiceEntries.map(e => e.userId)).size;
      
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🎤 Voice Activity')
        .setDescription(
          `**${uniqueUsers}** member${uniqueUsers === 1 ? '' : 's'} earned **${totalVoiceXP} XP** from voice/streaming`
        )
        .setTimestamp();

      // Show top 5 voice earners
      const topVoice = voiceEntries
        .sort((a, b) => b.xpGained - a.xpGained)
        .slice(0, 5)
        .map(e => `<@${e.userId}>: +${e.xpGained} XP`)
        .join('\n');
      
      if (topVoice) {
        embed.addFields({ name: 'Top Earners', value: topVoice, inline: false });
      }

      embeds.push(embed);
    }

    // Text XP summary
    if (textEntries.length > 0) {
      const totalTextXP = textEntries.reduce((sum, e) => sum + e.xpGained, 0);
      const uniqueUsers = new Set(textEntries.map(e => e.userId)).size;
      const totalMessages = textEntries.length;

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('💬 Text Activity')
        .setDescription(
          `**${uniqueUsers}** member${uniqueUsers === 1 ? '' : 's'} sent **${totalMessages}** message${totalMessages === 1 ? '' : 's'} (+${totalTextXP} XP)`
        )
        .setTimestamp();

      // Show top 5 text earners
      const userXP = new Map<string, number>();
      textEntries.forEach(e => {
        userXP.set(e.userId, (userXP.get(e.userId) || 0) + e.xpGained);
      });

      const topText = Array.from(userXP.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userId, xp]) => `<@${userId}>: +${xp} XP`)
        .join('\n');

      if (topText) {
        embed.addFields({ name: 'Top Earners', value: topText, inline: false });
      }

      embeds.push(embed);
    }

    // Level ups
    if (levelUps.length > 0) {
      const levelUpText = levelUps
        .map(e => `🎉 <@${e.userId}> reached **Level ${e.newLevel}**!`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🎊 Level Ups!')
        .setDescription(levelUpText)
        .setTimestamp();

      embeds.push(embed);
    }

    // Send embeds
    if (embeds.length > 0) {
      await channel.send({ embeds });
    }
  }

  /**
   * Start periodic status updates
   */
  private startStatusUpdates() {
    this.statusUpdateInterval = setInterval(async () => {
      for (const [guildId, channelIds] of this.monitoringChannels.entries()) {
        if (!channelIds.status) continue;

        try {
          const channel = this.client?.channels.cache.get(channelIds.status) as TextChannel;
          if (channel) {
            await this.updateStatusChannel(guildId, channel);
          }
        } catch (err) {
          error(`[LiveMonitor] Error updating status for guild ${guildId}:`, err);
        }
      }
    }, STATUS_UPDATE_INTERVAL);
  }

  /**
   * Update status channel with current bot stats
   */
  private async updateStatusChannel(guildId: string, channel: TextChannel) {
    try {
      const guild = this.client?.guilds.cache.get(guildId);
      if (!guild || !this.client) return;

      const uptime = process.uptime();
      const uptimeStr = this.formatUptime(uptime);
      
      const totalGuilds = this.client.guilds.cache.size;
      const totalMembers = this.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
      
      const memoryUsage = process.memoryUsage();
      const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🤖 TeraBot Live Status')
        .setDescription('Real-time bot statistics and information')
        .addFields(
          { name: '⏱️ Uptime', value: uptimeStr, inline: true },
          { name: '🌐 Servers', value: totalGuilds.toString(), inline: true },
          { name: '👥 Total Members', value: totalMembers.toLocaleString(), inline: true },
          { name: '💾 Memory Usage', value: `${memoryMB} MB`, inline: true },
          { name: '📊 This Server', value: `${guild.memberCount} members`, inline: true },
          { name: '🏓 Ping', value: `${this.client.ws.ping}ms`, inline: true }
        )
        .setFooter({ text: 'Updates every 60 seconds' })
        .setTimestamp();

      // Get or send the status message
      const messages = await channel.messages.fetch({ limit: 1 });
      const lastMessage = messages.first();

      if (lastMessage && lastMessage.author.id === this.client.user?.id) {
        // Update existing message
        await lastMessage.edit({ embeds: [embed] });
      } else {
        // Send new message
        await channel.send({ embeds: [embed] });
      }

    } catch (err) {
      error('[LiveMonitor] Error updating status channel:', err);
    }
  }

  /**
   * Format uptime duration
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '< 1m';
  }

  /**
   * Cleanup and stop monitoring
   */
  stop() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
    if (this.xpBatchInterval) {
      clearInterval(this.xpBatchInterval);
      this.xpBatchInterval = null;
    }
    info('[LiveMonitor] Stopped live monitoring');
  }
}

// Export singleton instance
export const liveMonitor = new LiveMonitor();
