/**
 * Rate Limiter
 * Prevents rapid-fire command abuse using sliding window algorithm
 * Separate from cooldowns - enforces global limits across all commands
 */

import { warn, error } from './logger';

interface RateLimitEntry {
  timestamps: number[]; // Recent command timestamps
  violations: number; // Number of rate limit violations
}

interface RateLimitConfig {
  maxCommands: number; // Max commands in time window
  windowMs: number; // Time window in milliseconds
  penaltyMs: number; // Penalty duration for violations
}

class RateLimiter {
  // Map: userId -> rate limit entry
  private limits: Map<string, RateLimitEntry> = new Map();

  // Track users on penalty (temporary ban from commands)
  private penalties: Map<string, number> = new Map(); // userId -> penalty end timestamp

  // Default configuration
  private config: RateLimitConfig = {
    maxCommands: 10, // 10 commands
    windowMs: 60000, // per 60 seconds
    penaltyMs: 120000 // 2 minute penalty for violations
  };

  /**
   * Check if user is within rate limits
   * @returns Object with status and remaining commands
   */
  checkLimit(userId: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    message: string;
  } {
    const now = Date.now();

    // Check if user is on penalty
    const penaltyEnd = this.penalties.get(userId);
    if (penaltyEnd && now < penaltyEnd) {
      const remainingMs = penaltyEnd - now;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: penaltyEnd,
        message: `⛔ You've been temporarily restricted from using commands. Try again in ${this.formatTime(remainingMs)}.`
      };
    } else if (penaltyEnd) {
      // Penalty expired, clear it
      this.penalties.delete(userId);
    }

    // Get or create rate limit entry
    let entry = this.limits.get(userId);
    if (!entry) {
      entry = { timestamps: [], violations: 0 };
      this.limits.set(userId, entry);
    }

    // Remove timestamps outside the current window
    const windowStart = now - this.config.windowMs;
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    // Calculate remaining commands
    const commandsUsed = entry.timestamps.length;
    const remaining = Math.max(0, this.config.maxCommands - commandsUsed);
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetTime = oldestTimestamp + this.config.windowMs;

    // Check if limit exceeded
    if (commandsUsed >= this.config.maxCommands) {
      entry.violations++;
      
      // Apply penalty after 3 violations
      if (entry.violations >= 3) {
        this.applyPenalty(userId);
        warn(`[RateLimit] User ${userId} penalized for ${entry.violations} violations`);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + this.config.penaltyMs,
          message: `🚫 Too many rate limit violations! You've been temporarily restricted for ${this.formatTime(this.config.penaltyMs)}.`
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        message: `⏰ Rate limit exceeded! You can use ${this.config.maxCommands} commands per ${this.formatTime(this.config.windowMs)}. Try again in ${this.formatTime(resetTime - now)}.`
      };
    }

    return {
      allowed: true,
      remaining,
      resetTime,
      message: ''
    };
  }

  /**
   * Record a command execution for rate limiting
   */
  recordCommand(userId: string): void {
    const now = Date.now();
    
    let entry = this.limits.get(userId);
    if (!entry) {
      entry = { timestamps: [], violations: 0 };
      this.limits.set(userId, entry);
    }

    entry.timestamps.push(now);

    // Clean up old data periodically
    if (this.limits.size > 5000) {
      this.cleanup();
    }
  }

  /**
   * Apply penalty to user (temporary command ban)
   */
  private applyPenalty(userId: string): void {
    const penaltyEnd = Date.now() + this.config.penaltyMs;
    this.penalties.set(userId, penaltyEnd);
    
    // Reset violations
    const entry = this.limits.get(userId);
    if (entry) {
      entry.violations = 0;
    }
  }

  /**
   * Clear penalties and rate limit data for a user (admin tool)
   */
  clearUser(userId: string): void {
    this.limits.delete(userId);
    this.penalties.delete(userId);
    warn(`[RateLimit] Cleared all rate limit data for user ${userId}`);
  }

  /**
   * Check if user is bypassed from rate limits (bot owner, admins)
   */
  isBypassed(userId: string): boolean {
    const botOwnerId = process.env.BOT_OWNER_ID;
    if (botOwnerId && userId === botOwnerId) {
      return true;
    }
    
    return false;
  }

  /**
   * Update rate limit configuration
   */
  configure(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    warn(`[RateLimit] Configuration updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // Clean expired rate limit entries
    for (const [userId, entry] of this.limits) {
      const windowStart = now - this.config.windowMs;
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
      
      // Remove entry if no recent activity and no violations
      if (entry.timestamps.length === 0 && entry.violations === 0) {
        this.limits.delete(userId);
        cleaned++;
      }
    }

    // Clean expired penalties
    for (const [userId, penaltyEnd] of this.penalties) {
      if (now > penaltyEnd) {
        this.penalties.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      warn(`[RateLimit] Cleaned up ${cleaned} expired entries`);
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
   * Get statistics about current rate limits
   */
  getStats(): {
    totalTracked: number;
    usersOnPenalty: number;
    recentViolations: number;
    config: RateLimitConfig;
  } {
    let violations = 0;
    for (const entry of this.limits.values()) {
      if (entry.violations > 0) violations++;
    }

    return {
      totalTracked: this.limits.size,
      usersOnPenalty: this.penalties.size,
      recentViolations: violations,
      config: this.getConfig()
    };
  }

  /**
   * Get user's current rate limit status (admin tool)
   */
  getUserStatus(userId: string): {
    commandsUsed: number;
    remaining: number;
    violations: number;
    onPenalty: boolean;
    penaltyEnds?: number;
  } {
    const entry = this.limits.get(userId);
    const penaltyEnd = this.penalties.get(userId);
    const now = Date.now();

    if (!entry) {
      return {
        commandsUsed: 0,
        remaining: this.config.maxCommands,
        violations: 0,
        onPenalty: false
      };
    }

    const windowStart = now - this.config.windowMs;
    const recentCommands = entry.timestamps.filter(ts => ts > windowStart);

    const result: {
      commandsUsed: number;
      remaining: number;
      violations: number;
      onPenalty: boolean;
      penaltyEnds?: number;
    } = {
      commandsUsed: recentCommands.length,
      remaining: Math.max(0, this.config.maxCommands - recentCommands.length),
      violations: entry.violations,
      onPenalty: penaltyEnd ? now < penaltyEnd : false
    };

    if (penaltyEnd) {
      result.penaltyEnds = penaltyEnd;
    }

    return result;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
