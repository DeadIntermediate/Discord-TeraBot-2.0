CREATE TABLE IF NOT EXISTS guild_backups (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR NOT NULL REFERENCES discord_servers(id),
  name VARCHAR NOT NULL,
  description TEXT,
  created_by VARCHAR NOT NULL REFERENCES discord_users(id),
  roles_data JSONB NOT NULL,
  channels_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_restore_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR NOT NULL REFERENCES discord_servers(id),
  backup_id VARCHAR NOT NULL REFERENCES guild_backups(id),
  restored_by VARCHAR NOT NULL REFERENCES discord_users(id),
  status VARCHAR NOT NULL,
  items_restored INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_guild_backups_server ON guild_backups(server_id);
CREATE INDEX idx_guild_backups_created ON guild_backups(created_at DESC);
CREATE INDEX idx_backup_restore_server ON backup_restore_history(server_id);
CREATE INDEX idx_backup_restore_backup ON backup_restore_history(backup_id);
CREATE INDEX idx_backup_restore_status ON backup_restore_history(status);
