import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env at the very top before any checks
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: dirname(__dirname) + '/.env' });

import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { warn } from './utils/logger';

if (!process.env.DATABASE_URL && process.env.SKIP_DB !== 'true') {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database? If you want to skip DB for local dev, set SKIP_DB=true",
  );
}

let pool: any;
let db: any;

if (process.env.SKIP_DB === 'true') {
  // eslint-disable-next-line no-console
  warn('⚠️ SKIP_DB=true — running with a lightweight in-memory DB stub for local dev.');

  // Minimal pool stub with query and end methods to allow startup. Any real DB calls will
  // either return safe defaults or throw informative errors.
  pool = {
    query: async (q: string) => {
      warn('⚠️ DB query executed in SKIP_DB mode:', q.substring(0, 200));
      return { rows: [{ now: new Date().toISOString(), current_time: new Date().toISOString(), pg_version: 'SKIP_DB' }], rowCount: 0 };
    },
    end: async () => {},
  };

  // Minimal drizzle-like stub (only what startup paths may call). For real DB ops,
  // code should use a real DATABASE_URL. These stubs will throw if used in critical paths.
  db = {
    select: () => ({ from: () => { throw new Error('DB select called in SKIP_DB mode'); } }),
    insert: () => ({ values: () => { throw new Error('DB insert called in SKIP_DB mode'); } }),
    update: () => ({ set: () => { throw new Error('DB update called in SKIP_DB mode'); } }),
  };
} else {
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20, // maximum number of connections in the pool
    idleTimeoutMillis: 30000, // close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // return error after 2 seconds if connection could not be established
    statement_timeout: 5000, // timeout individual queries after 5 seconds
  });

  db = drizzle(pool, { schema });
}

export { pool, db };

// Database health check function
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { info, debug, error } = await import('./utils/logger');
    info('🔍 Testing database connection...');
    const testConnection = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    info('✅ PostgreSQL connected successfully');
    debug(`🕐 Database time: ${testConnection.rows[0].current_time}`);
    debug(`📊 PostgreSQL version: ${testConnection.rows[0].pg_version.split(' ')[0]} ${testConnection.rows[0].pg_version.split(' ')[1]}`);
    return true;
  } catch (error: any) {
    const { error: logError } = await import('./utils/logger');
    logError('❌ PostgreSQL connection failed:');
    logError(`   Error: ${error.message}`);
    if (error.code) {
      logError(`   Code: ${error.code}`);
    }
    if (error.detail) {
      logError(`   Detail: ${error.detail}`);
    }
    return false;
  }
}

// Function to safely close database connections
export async function closeDatabaseConnection(): Promise<void> {
  try {
    const { info, error } = await import('./utils/logger');
    info('🔄 Closing database connections...');
    await pool.end();
    info('✅ Database connections closed successfully');
  } catch (error: any) {
    const { error: logError } = await import('./utils/logger');
    logError('❌ Error closing database connections:', error.message);
  }
}