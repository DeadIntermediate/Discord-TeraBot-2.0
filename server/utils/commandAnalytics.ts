/**
 * Command Usage Analytics
 * Track command usage for insights and optimization
 */

import { db } from '../db';
import { commandUsageAnalytics } from '../../shared/schema';
import { sql, desc, eq, and, gte } from 'drizzle-orm';
import { info, warn } from './logger';

interface CommandUsage {
  commandName: string;
  userId: string;
  guildId?: string;
  success: boolean;
  executionTime?: number;
  errorMessage?: string;
}

interface AnalyticsStats {
  totalCommands: number;
  successRate: number;
  topCommands: Array<{ command: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  avgExecutionTime: number;
}

class CommandAnalytics {
  private enabled: boolean;
  private batchSize = 10;
  private batchQueue: CommandUsage[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.enabled = process.env.ANALYTICS_ENABLED !== 'false'; // Enabled by default
  }

  /**
   * Start analytics batch processing
   */
  start(): void {
    if (!this.enabled) {
      info('[Analytics] Command analytics disabled');
      return;
    }

    // Flush batched analytics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);

    info('[Analytics] Command analytics enabled');
  }

  /**
   * Stop analytics
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining data
    this.flush();
    info('[Analytics] Command analytics stopped');
  }

  /**
   * Record a command execution
   */
  async recordCommand(usage: CommandUsage): Promise<void> {
    if (!this.enabled) return;

    // Add to batch queue
    this.batchQueue.push({
      ...usage,
      guildId: usage.guildId || null as any,
      executionTime: usage.executionTime || null as any,
      errorMessage: usage.errorMessage || null as any
    });

    // Flush if batch is full
    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush batched analytics to database
   */
  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    try {
      const batch = [...this.batchQueue];
      this.batchQueue = [];

      await db.insert(commandUsageAnalytics).values(
        batch.map(usage => ({
          commandName: usage.commandName,
          userId: usage.userId,
          guildId: usage.guildId || null,
          success: usage.success,
          executionTime: usage.executionTime || null,
          errorMessage: usage.errorMessage || null,
          executedAt: new Date()
        }))
      );

      // info(`[Analytics] Flushed ${batch.length} command usage records`);
    } catch (error) {
      warn('[Analytics] Failed to flush analytics:', error);
      // Don't crash - analytics failures shouldn't break the bot
    }
  }

  /**
   * Get analytics statistics for a time period
   */
  async getStats(days: number = 7): Promise<AnalyticsStats> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      // Total commands
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(commandUsageAnalytics)
        .where(gte(commandUsageAnalytics.executedAt, cutoffDate));

      const total = totalResult[0]?.count || 0;

      // Success rate
      const successResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(commandUsageAnalytics)
        .where(
          and(
            gte(commandUsageAnalytics.executedAt, cutoffDate),
            eq(commandUsageAnalytics.success, true)
          )
        );

      const successful = successResult[0]?.count || 0;
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      // Top commands
      const topCommands = await db
        .select({
          command: commandUsageAnalytics.commandName,
          count: sql<number>`count(*)`
        })
        .from(commandUsageAnalytics)
        .where(gte(commandUsageAnalytics.executedAt, cutoffDate))
        .groupBy(commandUsageAnalytics.commandName)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Top users
      const topUsers = await db
        .select({
          userId: commandUsageAnalytics.userId,
          count: sql<number>`count(*)`
        })
        .from(commandUsageAnalytics)
        .where(gte(commandUsageAnalytics.executedAt, cutoffDate))
        .groupBy(commandUsageAnalytics.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Average execution time
      const avgTimeResult = await db
        .select({ avg: sql<number>`avg(execution_time)` })
        .from(commandUsageAnalytics)
        .where(
          and(
            gte(commandUsageAnalytics.executedAt, cutoffDate),
            sql`execution_time IS NOT NULL`
          )
        );

      const avgExecutionTime = avgTimeResult[0]?.avg || 0;

      return {
        totalCommands: total,
        successRate: Math.round(successRate * 100) / 100,
        topCommands,
        topUsers,
        avgExecutionTime: Math.round(avgExecutionTime * 100) / 100
      };
    } catch (error) {
      warn('[Analytics] Failed to get stats:', error);
      return {
        totalCommands: 0,
        successRate: 0,
        topCommands: [],
        topUsers: [],
        avgExecutionTime: 0
      };
    }
  }

  /**
   * Get command-specific statistics
   */
  async getCommandStats(commandName: string, days: number = 30): Promise<{
    totalUses: number;
    successRate: number;
    uniqueUsers: number;
    avgExecutionTime: number;
    commonErrors: Array<{ error: string; count: number }>;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      // Total uses
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(commandUsageAnalytics)
        .where(
          and(
            eq(commandUsageAnalytics.commandName, commandName),
            gte(commandUsageAnalytics.executedAt, cutoffDate)
          )
        );

      const total = totalResult[0]?.count || 0;

      // Success rate
      const successResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(commandUsageAnalytics)
        .where(
          and(
            eq(commandUsageAnalytics.commandName, commandName),
            gte(commandUsageAnalytics.executedAt, cutoffDate),
            eq(commandUsageAnalytics.success, true)
          )
        );

      const successful = successResult[0]?.count || 0;
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      // Unique users
      const uniqueUsersResult = await db
        .select({ count: sql<number>`count(distinct user_id)` })
        .from(commandUsageAnalytics)
        .where(
          and(
            eq(commandUsageAnalytics.commandName, commandName),
            gte(commandUsageAnalytics.executedAt, cutoffDate)
          )
        );

      const uniqueUsers = uniqueUsersResult[0]?.count || 0;

      // Average execution time
      const avgTimeResult = await db
        .select({ avg: sql<number>`avg(execution_time)` })
        .from(commandUsageAnalytics)
        .where(
          and(
            eq(commandUsageAnalytics.commandName, commandName),
            gte(commandUsageAnalytics.executedAt, cutoffDate),
            sql`execution_time IS NOT NULL`
          )
        );

      const avgExecutionTime = avgTimeResult[0]?.avg || 0;

      // Common errors
      const commonErrors = await db
        .select({
          error: commandUsageAnalytics.errorMessage,
          count: sql<number>`count(*)`
        })
        .from(commandUsageAnalytics)
        .where(
          and(
            eq(commandUsageAnalytics.commandName, commandName),
            gte(commandUsageAnalytics.executedAt, cutoffDate),
            sql`error_message IS NOT NULL`
          )
        )
        .groupBy(commandUsageAnalytics.errorMessage)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      return {
        totalUses: total,
        successRate: Math.round(successRate * 100) / 100,
        uniqueUsers,
        avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
        commonErrors: commonErrors.map((e: any) => ({ error: e.error || 'Unknown', count: e.count }))
      };
    } catch (error) {
      warn('[Analytics] Failed to get command stats:', error);
      return {
        totalUses: 0,
        successRate: 0,
        uniqueUsers: 0,
        avgExecutionTime: 0,
        commonErrors: []
      };
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await db
        .delete(commandUsageAnalytics)
        .where(sql`executed_at < ${cutoffDate}`);

      const deletedCount = result.rowCount || 0;
      info(`[Analytics] Cleaned up ${deletedCount} old analytics records`);
      return deletedCount;
    } catch (error) {
      warn('[Analytics] Failed to cleanup analytics:', error);
      return 0;
    }
  }

  /**
   * Get status
   */
  getStatus(): {
    enabled: boolean;
    queueSize: number;
    isRunning: boolean;
  } {
    return {
      enabled: this.enabled,
      queueSize: this.batchQueue.length,
      isRunning: this.flushInterval !== null
    };
  }
}

// Export singleton instance
export const commandAnalytics = new CommandAnalytics();
