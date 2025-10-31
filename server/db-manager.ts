/**
 * PostgreSQL Database Manager with Connection Pooling and Query Optimization
 * Improves upon basic db.ts with better error handling, metrics, and resilience
 */

import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { warn, error as logError, info, debug } from './utils/logger';

/**
 * Connection pool configuration with optimized defaults
 */
const POOL_CONFIG = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '5000'),
  // New: Application name for monitoring
  application_name: 'terabot',
  // New: SSL mode for security
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

/**
 * Database connection metrics for monitoring
 */
interface DbMetrics {
  totalQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}

class DatabaseManager {
  private pool: Pool | null = null;
  private db: any = null;
  private metrics: DbMetrics = {
    totalQueries: 0,
    failedQueries: 0,
    averageQueryTime: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
  };
  private queryTimes: number[] = [];
  private skipDb = process.env.SKIP_DB === 'true';

  /**
   * Initialize database connection
   */
  async initialize(): Promise<boolean> {
    if (this.skipDb) {
      warn('⚠️ SKIP_DB=true — Database disabled for local development');
      return true;
    }

    if (!process.env.DATABASE_URL) {
      logError('❌ DATABASE_URL not set in environment variables');
      return false;
    }

    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ...POOL_CONFIG,
      });

      // Setup pool event handlers
      this.setupPoolEventHandlers();

      // Create drizzle instance
      this.db = drizzle(this.pool, { schema });

      // Test connection
      const isConnected = await this.testConnection();
      if (!isConnected) return false;

      info('✅ Database initialized successfully');
      return true;
    } catch (err) {
      logError('❌ Failed to initialize database:', err);
      return false;
    }
  }

  /**
   * Setup event handlers for connection pool
   */
  private setupPoolEventHandlers(): void {
    if (!this.pool) return;

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logError('❌ Unexpected error in pool:', err);
    });

    // Log pool events
    this.pool.on('connect', () => {
      debug('📡 New connection established');
    });

    this.pool.on('remove', () => {
      debug('📡 Connection removed from pool');
    });
  }

  /**
   * Test database connection with detailed diagnostics
   */
  async testConnection(): Promise<boolean> {
    try {
      const startTime = Date.now();

      const result = await this.pool?.query(`
        SELECT 
          NOW() as current_time,
          version() as pg_version,
          current_database() as database,
          current_user as user
      `);

      const duration = Date.now() - startTime;

      if (result?.rows[0]) {
        const row = result.rows[0];
        info('✅ PostgreSQL connected successfully');
        debug(`📊 Connection details:`);
        debug(`   Database: ${row.database}`);
        debug(`   User: ${row.user}`);
        debug(`   Time: ${row.current_time}`);
        debug(`   Version: ${row.pg_version.split(',')[0]}`);
        debug(`   Latency: ${duration}ms`);
        return true;
      }

      return false;
    } catch (err: any) {
      logError('❌ Database connection test failed:');
      logError(`   Message: ${err.message}`);
      if (err.code) logError(`   Code: ${err.code}`);
      return false;
    }
  }

  /**
   * Execute query with metrics tracking
   */
  async executeQuery<T>(
    name: string,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T | null> {
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      if (!this.pool) {
        throw new Error('Database pool not initialized');
      }

      client = await this.pool.connect();
      const result = await callback(client);

      const duration = Date.now() - startTime;
      this.recordQueryMetric(name, duration, true);

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.recordQueryMetric(name, duration, false);
      logError(`❌ Query failed (${name}):`, err);
      return null;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Record query metrics for monitoring
   */
  private recordQueryMetric(name: string, duration: number, success: boolean): void {
    this.metrics.totalQueries++;

    if (!success) {
      this.metrics.failedQueries++;
    }

    // Keep last 100 query times for average
    this.queryTimes.push(duration);
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }

    this.metrics.averageQueryTime =
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;

    // Log slow queries
    if (duration > 1000) {
      warn(`⚠️ Slow query (${name}): ${duration}ms`);
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): DbMetrics {
    if (this.pool) {
      this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
      this.metrics.idleConnections = this.pool.idleCount;
      this.metrics.waitingRequests = this.pool.waitingCount;
    }
    return { ...this.metrics };
  }

  /**
   * Get pool status
   */
  getPoolStatus(): {
    total: number;
    idle: number;
    active: number;
    waiting: number;
  } | null {
    if (!this.pool) return null;

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      active: this.pool.totalCount - this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Get drizzle database instance
   */
  getDb(): any {
    return this.db;
  }

  /**
   * Get pool instance
   */
  getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      if (this.pool) {
        info('🔌 Closing database connections...');
        await this.pool.end();
        info('✅ Database connections closed');
      }
    } catch (err) {
      logError('❌ Error closing database:', err);
    }
  }
}

export const dbManager = new DatabaseManager();

/**
 * Export for backward compatibility
 */
export async function initializeDatabase(): Promise<boolean> {
  return await dbManager.initialize();
}

export function getDb(): any {
  return dbManager.getDb();
}

export function getPool(): Pool | null {
  return dbManager.getPool();
}

export function getDatabaseMetrics(): DbMetrics {
  return dbManager.getMetrics();
}

export function getPoolStatus() {
  return dbManager.getPoolStatus();
}

export async function shutdownDatabase(): Promise<void> {
  await dbManager.shutdown();
}
