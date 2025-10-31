/**
 * Enhanced Storage Layer with Query Optimization
 * Provides caching, batch operations, and performance improvements
 */

import { info, debug, warn } from './utils/logger';

/**
 * Simple LRU Cache implementation without external dependency
 */
class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 300000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);

    if (!item) return undefined;

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    this.cache.delete(key);

    // Add to end
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // Remove oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value as K;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Cache configuration
 */
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const CACHE_MAX_SIZE = 1000;

/**
 * Cache manager for reducing database queries
 */
export class CacheManager {
  private memberCache: LRUCache<string, any>;
  private serverCache: LRUCache<string, any>;
  private userCache: LRUCache<string, any>;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  constructor() {
    this.memberCache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL);
    this.serverCache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL);
    this.userCache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL);
  }

  /**
   * Get member from cache
   */
  getMember(serverId: string, userId: string): any | undefined {
    const key = `${serverId}:${userId}`;
    const value = this.memberCache.get(key);

    if (value) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    return value;
  }

  /**
   * Set member in cache
   */
  setMember(serverId: string, userId: string, data: any): void {
    const key = `${serverId}:${userId}`;
    this.memberCache.set(key, data);
    this.stats.sets++;
  }

  /**
   * Invalidate member cache
   */
  invalidateMember(serverId: string, userId: string): void {
    const key = `${serverId}:${userId}`;
    this.memberCache.delete(key);
    debug(`🧹 Invalidated cache: member ${key}`);
  }

  /**
   * Get server from cache
   */
  getServer(serverId: string): any | undefined {
    return this.serverCache.get(serverId);
  }

  /**
   * Set server in cache
   */
  setServer(serverId: string, data: any): void {
    this.serverCache.set(serverId, data);
  }

  /**
   * Invalidate server cache
   */
  invalidateServer(serverId: string): void {
    this.serverCache.delete(serverId);
  }

  /**
   * Get user from cache
   */
  getUser(userId: string): any | undefined {
    return this.userCache.get(userId);
  }

  /**
   * Set user in cache
   */
  setUser(userId: string, data: any): void {
    this.userCache.set(userId, data);
  }

  /**
   * Get cache stats
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : '0';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memberCacheSize: this.memberCache.size,
      serverCacheSize: this.serverCache.size,
      userCacheSize: this.userCache.size,
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.memberCache.clear();
    this.serverCache.clear();
    this.userCache.clear();
    debug('🧹 All caches cleared');
  }
}

export const cacheManager = new CacheManager();

/**
 * Batch operation manager for reducing individual queries
 */
export class BatchOperationManager {
  private memberBatches: Map<string, any[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(private storage: any) {
    // Auto-flush every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  /**
   * Queue member update
   */
  queueMemberUpdate(
    serverId: string,
    userId: string,
    updates: any
  ): void {
    const key = `${serverId}:${userId}`;

    if (!this.memberBatches.has(key)) {
      this.memberBatches.set(key, []);
    }

    this.memberBatches.get(key)!.push(updates);
  }

  /**
   * Flush pending operations
   */
  async flush(): Promise<void> {
    const entries = Array.from(this.memberBatches.entries());

    if (entries.length === 0) return;

    try {
      for (const [key, updates] of entries) {
        const [serverId, userId] = key.split(':');

        // Merge all updates
        const merged = Object.assign({}, ...updates);

        // Execute update
        await this.storage.updateServerMember(serverId, userId, merged);

        // Clear from batch
        this.memberBatches.delete(key);
      }

      debug(`📦 Flushed ${entries.length} batched updates`);
    } catch (err) {
      warn('⚠️ Error flushing batch operations:', err);
    }
  }

  /**
   * Shutdown batch operations
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  /**
   * Check if query result is large and may benefit from pagination
   */
  static shouldPaginate(resultCount: number, threshold: number = 1000): boolean {
    return resultCount > threshold;
  }

  /**
   * Generate optimized leaderboard query
   */
  static generateLeaderboardQuery(
    serverId: string,
    limit: number = 10,
    offset: number = 0,
    criteria: 'xp' | 'level' | 'voiceTime' = 'xp'
  ): any {
    // This would be implemented in the actual storage layer
    // For now, this is a helper for query construction
    return {
      serverId,
      limit,
      offset,
      criteria,
      orderBy: criteria,
    };
  }

  /**
   * Generate bulk update query
   */
  static generateBulkUpdateQuery(
    members: Array<{ serverId: string; userId: string; updates: any }>
  ): any {
    return {
      type: 'bulk_update',
      count: members.length,
      members,
    };
  }
}

/**
 * Connection health monitor
 */
export class ConnectionHealthMonitor {
  private lastHealthCheck: Date = new Date();
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;

  constructor(private pool: any) {}

  /**
   * Check connection health
   */
  async check(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.consecutiveFailures = 0;
      this.lastHealthCheck = new Date();

      return true;
    } catch (err) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        warn(
          `⚠️ Database connection failing (${this.consecutiveFailures} consecutive failures)`
        );
      }

      return false;
    }
  }

  /**
   * Get health status
   */
  getStatus() {
    return {
      healthy: this.consecutiveFailures < this.maxConsecutiveFailures,
      consecutiveFailures: this.consecutiveFailures,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  /**
   * Reset failures
   */
  reset(): void {
    this.consecutiveFailures = 0;
  }
}

/**
 * Database performance monitor
 */
export class PerformanceMonitor {
  private slowQueryThreshold: number = 1000; // 1 second
  private queries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
    slow: boolean;
  }> = [];

  /**
   * Record query execution
   */
  recordQuery(query: string, duration: number): void {
    const slow = duration > this.slowQueryThreshold;

    this.queries.push({
      query: query.substring(0, 200), // Truncate for storage
      duration,
      timestamp: new Date(),
      slow,
    });

    // Keep last 1000 queries
    if (this.queries.length > 1000) {
      this.queries.shift();
    }

    if (slow) {
      warn(
        `⚠️ Slow query (${duration}ms): ${query.substring(0, 100)}...`
      );
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    if (this.queries.length === 0) {
      return { averageDuration: 0, slowQueryCount: 0, totalQueries: 0 };
    }

    const slowQueries = this.queries.filter((q) => q.slow).length;
    const averageDuration =
      this.queries.reduce((sum, q) => sum + q.duration, 0) / this.queries.length;

    return {
      averageDuration: averageDuration.toFixed(2),
      slowQueryCount: slowQueries,
      totalQueries: this.queries.length,
      slowQueryPercentage: ((slowQueries / this.queries.length) * 100).toFixed(2),
    };
  }
}
