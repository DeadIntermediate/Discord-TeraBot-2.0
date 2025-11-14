/**
 * Command Cooldown Manager
 * Prevents users from spamming commands and abusing systems
 */

import { info, warn } from './logger';

interface CooldownConfig {
  duration: number; // milliseconds
  message?: string; // custom cooldown message
}

class CooldownManager {
  // Map: "userId-commandName" -> timestamp of last use
  private cooldowns: Map<string, number> = new Map();

  // Default cooldown configurations for different command categories
  private defaultCooldowns: Record<string, CooldownConfig> = {
    // XP/Leveling commands (prevent spam)
    profile: { duration: 3000, message: 'Please wait before checking profiles again' },
    leaderboard: { duration: 5000, message: 'Leaderboard updates every 5 seconds' },
    
    // Games (prevent farming)
    games: { duration: 10000, message: 'You can play again in {time}' },
    trivia: { duration: 15000 },
    
    // Moderation (prevent mistakes)
    ban: { duration: 2000 },
    kick: { duration: 2000 },
    warn: { duration: 1000 },
    mute: { duration: 1000 },
    
    // Giveaways (prevent spam)
    giveaway: { duration: 5000 },
    
    // Utility (light cooldowns)
    help: { duration: 2000 },
    
    // Social media lookups (API rate limits)
    socialmedia: { duration: 10000, message: 'API cooldown: Please wait {time}' },
    
    // Stream commands
    stream: { duration: 3000 },
    
    // Heavy operations
    setup: { duration: 10000, message: 'Setup commands have a 10-second cooldown' },
    
    // Default for unlisted commands
    default: { duration: 1000 }
  };

  /**
   * Check if a user is on cooldown for a specific command
   * @returns Object with isOnCooldown status and remaining time
   */
  checkCooldown(userId: string, commandName: string): {
    isOnCooldown: boolean;
    remainingTime: number;
    message: string;
  } {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    const lastUsed = this.cooldowns.get(key);

    // Get cooldown config for this command
    const config = this.defaultCooldowns[commandName] || this.defaultCooldowns.default;
    if (!config) {
      throw new Error('Default cooldown config is missing');
    }
    const cooldownDuration = config.duration;

    if (!lastUsed) {
      return {
        isOnCooldown: false,
        remainingTime: 0,
        message: ''
      };
    }

    const timePassed = now - lastUsed;
    const remainingTime = cooldownDuration - timePassed;

    if (remainingTime > 0) {
      const timeString = this.formatTime(remainingTime);
      const message = config.message
        ? config.message.replace('{time}', timeString)
        : `Please wait ${timeString} before using this command again.`;

      return {
        isOnCooldown: true,
        remainingTime,
        message
      };
    }

    return {
      isOnCooldown: false,
      remainingTime: 0,
      message: ''
    };
  }

  /**
   * Set a cooldown for a user on a specific command
   */
  setCooldown(userId: string, commandName: string): void {
    const key = `${userId}-${commandName}`;
    this.cooldowns.set(key, Date.now());

    // Clean up old cooldowns periodically
    if (this.cooldowns.size > 10000) {
      this.cleanup();
    }
  }

  /**
   * Clear a specific user's cooldown for a command (admin override)
   */
  clearCooldown(userId: string, commandName: string): void {
    const key = `${userId}-${commandName}`;
    this.cooldowns.delete(key);
    info(`[Cooldown] Cleared cooldown for ${userId} on ${commandName}`);
  }

  /**
   * Clear all cooldowns for a user (admin tool)
   */
  clearUserCooldowns(userId: string): number {
    let cleared = 0;
    for (const [key] of this.cooldowns) {
      if (key.startsWith(`${userId}-`)) {
        this.cooldowns.delete(key);
        cleared++;
      }
    }
    info(`[Cooldown] Cleared ${cleared} cooldowns for user ${userId}`);
    return cleared;
  }

  /**
   * Set a custom cooldown duration for a specific command
   */
  setCustomCooldown(commandName: string, duration: number, message?: string): void {
    this.defaultCooldowns[commandName] = message
      ? { duration, message }
      : { duration };
    info(`[Cooldown] Custom cooldown set for ${commandName}: ${duration}ms`);
  }

  /**
   * Get remaining cooldown time for a user on a command
   */
  getRemainingTime(userId: string, commandName: string): number {
    const result = this.checkCooldown(userId, commandName);
    return result.remainingTime;
  }

  /**
   * Clean up expired cooldowns (runs automatically)
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, timestamp] of this.cooldowns) {
      const parts = key.split('-');
      const commandName = parts.length > 1 ? parts[1] : 'default';
      const config = commandName ? (this.defaultCooldowns[commandName] || this.defaultCooldowns.default) : this.defaultCooldowns.default;
      
      // If cooldown expired more than 5 minutes ago, remove it
      if (config && now - timestamp > config.duration + 300000) {
        this.cooldowns.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      warn(`[Cooldown] Cleaned up ${cleaned} expired cooldowns`);
    }
  }

  /**
   * Format milliseconds into human-readable time
   */
  private formatTime(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Get statistics about current cooldowns
   */
  getStats(): {
    totalCooldowns: number;
    activeUsers: number;
    commandsWithCooldowns: string[];
  } {
    const users = new Set<string>();
    const commands = new Set<string>();

    for (const key of this.cooldowns.keys()) {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const userId = parts[0];
        const commandName = parts[1];
        if (userId && commandName) {
          users.add(userId);
          commands.add(commandName);
        }
      }
    }

    return {
      totalCooldowns: this.cooldowns.size,
      activeUsers: users.size,
      commandsWithCooldowns: Array.from(commands)
    };
  }

  /**
   * Check if a user is bypassed from cooldowns (bot owner, admins)
   */
  isBypassed(userId: string, guildId?: string): boolean {
    // Bot owner always bypasses cooldowns
    const botOwnerId = process.env.BOT_OWNER_ID;
    if (botOwnerId && userId === botOwnerId) {
      return true;
    }

    // Add more bypass logic here (e.g., server admins)
    // This could be enhanced to check guild permissions
    
    return false;
  }
}

// Export singleton instance
export const cooldownManager = new CooldownManager();
