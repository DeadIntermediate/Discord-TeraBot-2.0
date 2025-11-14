/**
 * Database Backup Scheduler
 * Automated PostgreSQL backups with retention policy
 */

import cron, { ScheduledTask } from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, unlink, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { info, warn, error as logError } from './logger';

const execAsync = promisify(exec);

interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  backupPath: string;
  compress: boolean;
}

class DatabaseBackupScheduler {
  private config: BackupConfig;
  private cronJob: ScheduledTask | null = null;
  private isRunning = false;

  constructor() {
    this.config = {
      enabled: process.env.DB_BACKUPS_ENABLED === 'true',
      schedule: process.env.DB_BACKUP_SCHEDULE || '0 2 * * *', // Default: 2 AM daily
      retentionDays: parseInt(process.env.DB_BACKUP_RETENTION_DAYS || '7', 10),
      backupPath: process.env.DB_BACKUP_PATH || path.join(process.cwd(), 'db-backups'),
      compress: true
    };
  }

  /**
   * Start automated backup scheduler
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      info('[DB Backup] Database backups are disabled');
      return;
    }

    // Ensure backup directory exists
    await this.ensureBackupDirectory();

    // Validate cron schedule
    if (!cron.validate(this.config.schedule)) {
      logError('[DB Backup] Invalid cron schedule:', this.config.schedule);
      return;
    }

    // Schedule backups
    this.cronJob = cron.schedule(this.config.schedule, async () => {
      await this.createBackup();
    });

    this.isRunning = true;
    info(`[DB Backup] Automated backups scheduled: ${this.config.schedule}`);
    info(`[DB Backup] Backup path: ${this.config.backupPath}`);
    info(`[DB Backup] Retention: ${this.config.retentionDays} days`);

    // Run initial backup
    if (process.env.DB_BACKUP_ON_START === 'true') {
      info('[DB Backup] Running initial backup...');
      await this.createBackup();
    }
  }

  /**
   * Stop automated backups
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;
      info('[DB Backup] Automated backups stopped');
    }
  }

  /**
   * Create a database backup
   */
  async createBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `terabot_db_${timestamp}.sql${this.config.compress ? '.gz' : ''}`;
    const filepath = path.join(this.config.backupPath, filename);

    info(`[DB Backup] Starting database backup: ${filename}`);

    try {
      // Build pg_dump command
      const dbHost = process.env.DATABASE_HOST || 'localhost';
      const dbPort = process.env.DATABASE_PORT || '5432';
      const dbName = process.env.DATABASE_NAME || 'terabot';
      const dbUser = process.env.DATABASE_USER || 'postgres';
      const dbPassword = process.env.DATABASE_PASSWORD;

      if (!dbPassword) {
        throw new Error('DATABASE_PASSWORD is not set');
      }

      // Use PGPASSWORD environment variable for authentication
      const env = { ...process.env, PGPASSWORD: dbPassword };

      let command = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists`;

      if (this.config.compress) {
        command += ` | gzip > "${filepath}"`;
      } else {
        command += ` > "${filepath}"`;
      }

      // Execute backup
      await execAsync(command, { env });

      // Verify backup file exists and has content
      const stats = await stat(filepath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      info(`[DB Backup] ✅ Backup completed: ${filename} (${this.formatBytes(stats.size)})`);

      // Clean up old backups
      await this.cleanupOldBackups();

      return { success: true, filename };
    } catch (error) {
      logError('[DB Backup] ❌ Backup failed:', error);
      
      // Try to delete failed backup file
      try {
        if (existsSync(filepath)) {
          await unlink(filepath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Remove backups older than retention period
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await readdir(this.config.backupPath);
      const now = Date.now();
      const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith('terabot_db_')) continue;

        const filepath = path.join(this.config.backupPath, file);
        const stats = await stat(filepath);
        const age = now - stats.mtimeMs;

        if (age > retentionMs) {
          await unlink(filepath);
          deletedCount++;
          info(`[DB Backup] Deleted old backup: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)`);
        }
      }

      if (deletedCount > 0) {
        info(`[DB Backup] Cleanup complete: ${deletedCount} old backup(s) deleted`);
      }
    } catch (error) {
      warn('[DB Backup] Cleanup failed:', error);
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<Array<{ filename: string; size: number; date: Date }>> {
    try {
      await this.ensureBackupDirectory();
      const files = await readdir(this.config.backupPath);
      const backups = [];

      for (const file of files) {
        if (!file.startsWith('terabot_db_')) continue;

        const filepath = path.join(this.config.backupPath, file);
        const stats = await stat(filepath);

        backups.push({
          filename: file,
          size: stats.size,
          date: stats.mtime
        });
      }

      // Sort by date, newest first
      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      logError('[DB Backup] Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Restore from a backup file
   */
  async restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    const filepath = path.join(this.config.backupPath, filename);

    if (!existsSync(filepath)) {
      return { success: false, error: 'Backup file not found' };
    }

    info(`[DB Backup] Starting database restore from: ${filename}`);

    try {
      const dbHost = process.env.DATABASE_HOST || 'localhost';
      const dbPort = process.env.DATABASE_PORT || '5432';
      const dbName = process.env.DATABASE_NAME || 'terabot';
      const dbUser = process.env.DATABASE_USER || 'postgres';
      const dbPassword = process.env.DATABASE_PASSWORD;

      if (!dbPassword) {
        throw new Error('DATABASE_PASSWORD is not set');
      }

      const env = { ...process.env, PGPASSWORD: dbPassword };

      let command: string;
      if (filename.endsWith('.gz')) {
        command = `gunzip -c "${filepath}" | psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`;
      } else {
        command = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} < "${filepath}"`;
      }

      await execAsync(command, { env });

      info(`[DB Backup] ✅ Database restored from: ${filename}`);
      return { success: true };
    } catch (error) {
      logError('[DB Backup] ❌ Restore failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    if (!existsSync(this.config.backupPath)) {
      await mkdir(this.config.backupPath, { recursive: true });
      info(`[DB Backup] Created backup directory: ${this.config.backupPath}`);
    }
  }

  /**
   * Format bytes into human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get backup statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    isRunning: boolean;
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    config: BackupConfig;
  }> {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    const result: {
      enabled: boolean;
      isRunning: boolean;
      totalBackups: number;
      totalSize: number;
      oldestBackup?: Date;
      newestBackup?: Date;
      config: BackupConfig;
    } = {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      totalBackups: backups.length,
      totalSize,
      config: { ...this.config }
    };

    if (backups.length > 0) {
      const oldest = backups[backups.length - 1];
      const newest = backups[0];
      if (oldest) result.oldestBackup = oldest.date;
      if (newest) result.newestBackup = newest.date;
    }

    return result;
  }

  /**
   * Get current configuration
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const dbBackupScheduler = new DatabaseBackupScheduler();
