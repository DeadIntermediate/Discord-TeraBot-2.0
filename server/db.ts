import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // maximum number of connections in the pool
  idleTimeoutMillis: 30000, // close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // return error after 2 seconds if connection could not be established
  statement_timeout: 5000, // timeout individual queries after 5 seconds
});

export const db = drizzle(pool, { schema });

// Database health check function
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing database connection...');
    const testConnection = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ PostgreSQL connected successfully');
    console.log(`🕐 Database time: ${testConnection.rows[0].current_time}`);
    console.log(`📊 PostgreSQL version: ${testConnection.rows[0].pg_version.split(' ')[0]} ${testConnection.rows[0].pg_version.split(' ')[1]}`);
    return true;
  } catch (error: any) {
    console.error('❌ PostgreSQL connection failed:');
    console.error(`   Error: ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    return false;
  }
}

// Function to safely close database connections
export async function closeDatabaseConnection(): Promise<void> {
  try {
    console.log('🔄 Closing database connections...');
    await pool.end();
    console.log('✅ Database connections closed successfully');
  } catch (error: any) {
    console.error('❌ Error closing database connections:', error.message);
  }
}