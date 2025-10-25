import { EmbedBuilder, WebhookClient, Client } from 'discord.js';
import { storage } from '../storage.js';
import { debug, info, warn, error as logError } from './logger.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  serverId?: string;
  userId?: string;
  category: string;
  details?: Record<string, any>;
  messageId?: string;
}

/**
 * Send a log to Discord via webhook
 */
export async function sendLogToDiscord(
  level: LogLevel,
  message: string,
  context: LogContext,
  client?: Client
) {
  try {
    // Skip if no server ID
    if (!context.serverId) return;

    // Only log for Tera Bot guild
    const TERA_BOT_GUILD_ID = process.env.TERA_BOT_GUILD_ID;
    if (context.serverId !== TERA_BOT_GUILD_ID) {
      debug(`📋 Logging is only active in the Tera Bot guild, skipping for guild ${context.serverId}`);
      return;
    }

    // Get logging config for this server
    const loggingConfig = await storage.getLoggingConfig(context.serverId);
    if (!loggingConfig || !loggingConfig.isActive || !loggingConfig.webhookUrl) {
      debug(`📋 Logging disabled or not configured for server ${context.serverId}`);
      return;
    }

    // Check if this level should be logged
    if (level === 'debug' && !loggingConfig.logDebug) return;
    if (level === 'info' && !loggingConfig.logInfo) return;
    if (level === 'warn' && !loggingConfig.logWarnings) return;
    if (level === 'error' && !loggingConfig.logErrors) return;

    // Create embed
    const embed = createLogEmbed(level, message, context);

    // Send via webhook
    const webhook = new WebhookClient({ url: loggingConfig.webhookUrl });
    await webhook.send({
      embeds: [embed],
      username: '📋 Tera Bot Logs',
      avatarURL: client?.user?.avatarURL() || undefined,
    });

    // Mark as sent in database
    await storage.createBotLog({
      serverId: context.serverId,
      level,
      category: context.category,
      message,
      details: context.details,
      userId: context.userId,
      messageId: context.messageId,
      sentToDiscord: true,
    });
  } catch (err) {
    logError('Failed to send log to Discord:', err);
  }
}

/**
 * Create a formatted embed for a log entry
 */
function createLogEmbed(level: LogLevel, message: string, context: LogContext): EmbedBuilder {
  const colors = {
    debug: 0x9e9e9e,   // Gray
    info: 0x2196f3,    // Blue
    warn: 0xff9800,    // Orange
    error: 0xf44336,   // Red
  };

  const icons = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  const embed = new EmbedBuilder()
    .setColor(colors[level])
    .setTitle(`${icons[level]} ${level.toUpperCase()} - ${context.category}`)
    .setDescription(message)
    .setTimestamp(new Date())
    .setFooter({ text: 'Tera Bot Logger' });

  // Add fields if we have extra details
  if (context.details && Object.keys(context.details).length > 0) {
    const detailsStr = Object.entries(context.details)
      .map(([key, value]) => `**${key}**: \`${JSON.stringify(value).substring(0, 100)}\``)
      .join('\n');

    if (detailsStr) {
      embed.addFields({ name: '📊 Details', value: detailsStr, inline: false });
    }
  }

  if (context.userId) {
    embed.addFields({ name: '👤 User', value: `<@${context.userId}>`, inline: true });
  }

  if (context.messageId) {
    embed.addFields({ name: '💬 Message', value: `[Link](https://discord.com/channels/${context.serverId}/${context.messageId.split('-')[0]}/${context.messageId})`, inline: true });
  }

  return embed;
}

/**
 * Log an error to Discord
 */
export async function logErrorToDiscord(
  message: string,
  error: any,
  context: LogContext,
  client?: Client
) {
  await sendLogToDiscord('error', message, {
    ...context,
    details: {
      ...context.details,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack?.substring(0, 200) || undefined,
    },
  }, client);
}

/**
 * Log a command execution to Discord
 */
export async function logCommandToDiscord(
  commandName: string,
  userId: string,
  serverId: string,
  success: boolean,
  error?: string,
  client?: Client
) {
  await sendLogToDiscord(success ? 'info' : 'warn', 
    `Command \`/${commandName}\` executed by <@${userId}> - ${success ? '✅ Success' : '❌ Failed'}`,
    {
      serverId,
      userId,
      category: 'Commands',
      details: error ? { error } : undefined,
    },
    client
  );
}

/**
 * Log a moderation action to Discord
 */
export async function logModerationToDiscord(
  action: string,
  moderatorId: string,
  targetUserId: string,
  serverId: string,
  reason?: string,
  client?: Client
) {
  await sendLogToDiscord('warn',
    `**${action}** action taken by <@${moderatorId}> on <@${targetUserId}>`,
    {
      serverId,
      userId: targetUserId,
      category: 'Moderation',
      details: reason ? { reason } : undefined,
    },
    client
  );
}

/**
 * Log a voice event to Discord
 */
export async function logVoiceToDiscord(
  event: 'joined' | 'left' | 'moved',
  userId: string,
  channelName: string,
  serverId: string,
  durationMinutes?: number,
  client?: Client
) {
  const eventMessages = {
    joined: `👤 **${event.toUpperCase()}** voice channel: ${channelName}`,
    left: `👤 **${event.toUpperCase()}** voice channel after ${durationMinutes} minutes`,
    moved: `👤 **${event.toUpperCase()}** to voice channel: ${channelName}`,
  };

  await sendLogToDiscord('info',
    eventMessages[event],
    {
      serverId,
      userId,
      category: 'Voice',
      details: durationMinutes ? { durationMinutes } : undefined,
    },
    client
  );
}

/**
 * Log a stream event to Discord
 */
export async function logStreamToDiscord(
  event: 'online' | 'offline',
  streamer: string,
  platform: string,
  serverId: string,
  details?: Record<string, any>,
  client?: Client
) {
  const message = event === 'online'
    ? `🔴 **${streamer}** is now **LIVE** on ${platform}`
    : `⚫ **${streamer}** has ended stream on ${platform}`;

  await sendLogToDiscord('info', message, {
    serverId,
    category: 'Streams',
    details,
  }, client);
}

/**
 * Log a bot system event to Discord
 */
export async function logSystemToDiscord(
  message: string,
  serverId: string,
  details?: Record<string, any>,
  client?: Client
) {
  await sendLogToDiscord('info', message, {
    serverId,
    category: 'System',
    details,
  }, client);
}
