/**
 * Error Reporter
 * Sends critical errors to Discord channel for monitoring
 */

import { WebhookClient, EmbedBuilder, Client } from 'discord.js';
import { error as logError, warn } from './logger';

interface ErrorReport {
  error: Error;
  context?: string;
  userId?: string;
  guildId?: string;
  commandName?: string;
  additionalData?: Record<string, any>;
}

class ErrorReporter {
  private webhookClient: WebhookClient | null = null;
  private client: Client | null = null;
  private errorChannelId: string | null = null;
  private enabled: boolean;
  private environment: string;

  constructor() {
    this.enabled = process.env.ERROR_REPORTING_ENABLED === 'true';
    this.environment = process.env.NODE_ENV || 'development';
    this.errorChannelId = process.env.ERROR_CHANNEL_ID || null;

    // Initialize webhook if URL provided
    const webhookUrl = process.env.ERROR_WEBHOOK_URL;
    if (webhookUrl && this.enabled) {
      try {
        this.webhookClient = new WebhookClient({ url: webhookUrl });
        warn('[ErrorReporter] Initialized with webhook');
      } catch (error) {
        logError('[ErrorReporter] Failed to initialize webhook:', error);
      }
    }
  }

  /**
   * Initialize with Discord client (alternative to webhook)
   */
  initialize(client: Client): void {
    this.client = client;
    if (this.errorChannelId) {
      warn(`[ErrorReporter] Initialized with channel ID: ${this.errorChannelId}`);
    }
  }

  /**
   * Report an error to Discord
   */
  async reportError(report: ErrorReport): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Don't spam errors in development unless explicitly enabled
    if (this.environment === 'development' && process.env.ERROR_REPORTING_DEV !== 'true') {
      return;
    }

    try {
      const embed = this.createErrorEmbed(report);

      // Try webhook first (non-blocking)
      if (this.webhookClient) {
        await this.webhookClient.send({
          embeds: [embed],
          username: 'Error Reporter',
          avatarURL: 'https://cdn.discordapp.com/emojis/1234567890.png' // Optional
        });
        return;
      }

      // Fallback to channel message
      if (this.client && this.errorChannelId) {
        const channel = await this.client.channels.fetch(this.errorChannelId);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      // Don't let error reporting crash the bot
      logError('[ErrorReporter] Failed to send error report:', error);
    }
  }

  /**
   * Create formatted error embed
   */
  private createErrorEmbed(report: ErrorReport): EmbedBuilder {
    const { error, context, userId, guildId, commandName, additionalData } = report;

    const embed = new EmbedBuilder()
      .setColor(0xFF0000) // Red
      .setTitle('🚨 Error Detected')
      .setTimestamp();

    // Error message
    embed.addFields({
      name: 'Error',
      value: `\`\`\`${error.message || 'Unknown error'}\`\`\``,
      inline: false
    });

    // Context
    if (context) {
      embed.addFields({
        name: 'Context',
        value: context,
        inline: false
      });
    }

    // Command info
    if (commandName) {
      embed.addFields({
        name: 'Command',
        value: `\`/${commandName}\``,
        inline: true
      });
    }

    // User info
    if (userId) {
      embed.addFields({
        name: 'User',
        value: `<@${userId}>`,
        inline: true
      });
    }

    // Guild info
    if (guildId) {
      embed.addFields({
        name: 'Guild ID',
        value: guildId,
        inline: true
      });
    }

    // Stack trace (truncated)
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 10);
      const truncatedStack = stackLines.join('\n');
      embed.addFields({
        name: 'Stack Trace',
        value: `\`\`\`${truncatedStack.substring(0, 1000)}\`\`\``,
        inline: false
      });
    }

    // Additional data
    if (additionalData && Object.keys(additionalData).length > 0) {
      const dataStr = JSON.stringify(additionalData, null, 2);
      embed.addFields({
        name: 'Additional Data',
        value: `\`\`\`json\n${dataStr.substring(0, 500)}\`\`\``,
        inline: false
      });
    }

    // Environment
    embed.setFooter({ text: `Environment: ${this.environment}` });

    return embed;
  }

  /**
   * Report command execution error
   */
  async reportCommandError(
    error: Error,
    commandName: string,
    userId: string,
    guildId?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    const report: ErrorReport = {
      error,
      context: 'Command execution failed',
      commandName,
      userId
    };
    if (guildId) report.guildId = guildId;
    if (additionalData) report.additionalData = additionalData;
    
    await this.reportError(report);
  }

  /**
   * Report event handler error
   */
  async reportEventError(
    error: Error,
    eventName: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    const report: ErrorReport = {
      error,
      context: `Event handler: ${eventName}`
    };
    if (additionalData) report.additionalData = additionalData;
    
    await this.reportError(report);
  }

  /**
   * Report database error
   */
  async reportDatabaseError(
    error: Error,
    query?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    await this.reportError({
      error,
      context: 'Database operation failed',
      additionalData: {
        ...additionalData,
        query: query?.substring(0, 200)
      }
    });
  }

  /**
   * Report API error (external services)
   */
  async reportAPIError(
    error: Error,
    apiName: string,
    endpoint?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    await this.reportError({
      error,
      context: `External API: ${apiName}`,
      additionalData: {
        ...additionalData,
        endpoint
      }
    });
  }

  /**
   * Test error reporting (for setup verification)
   */
  async sendTestReport(): Promise<boolean> {
    try {
      await this.reportError({
        error: new Error('This is a test error'),
        context: 'Error reporting test',
        additionalData: {
          timestamp: new Date().toISOString(),
          message: 'If you see this, error reporting is working!'
        }
      });
      return true;
    } catch (error) {
      logError('[ErrorReporter] Test failed:', error);
      return false;
    }
  }

  /**
   * Get reporter status
   */
  getStatus(): {
    enabled: boolean;
    environment: string;
    hasWebhook: boolean;
    hasClient: boolean;
    hasChannel: boolean;
  } {
    return {
      enabled: this.enabled,
      environment: this.environment,
      hasWebhook: this.webhookClient !== null,
      hasClient: this.client !== null,
      hasChannel: this.errorChannelId !== null
    };
  }

  /**
   * Disable error reporting
   */
  disable(): void {
    this.enabled = false;
    warn('[ErrorReporter] Disabled');
  }

  /**
   * Enable error reporting
   */
  enable(): void {
    this.enabled = true;
    warn('[ErrorReporter] Enabled');
  }
}

// Export singleton instance
export const errorReporter = new ErrorReporter();
