CREATE TABLE IF NOT EXISTS logging_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR NOT NULL UNIQUE REFERENCES discord_servers(id),
  channel_id VARCHAR NOT NULL,
  webhook_url TEXT,
  log_errors BOOLEAN DEFAULT true,
  log_warnings BOOLEAN DEFAULT true,
  log_info BOOLEAN DEFAULT true,
  log_debug BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR REFERENCES discord_servers(id),
  level VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  user_id VARCHAR REFERENCES discord_users(id),
  message_id VARCHAR,
  sent_to_discord BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bot_logs_server ON bot_logs(server_id);
CREATE INDEX idx_bot_logs_level ON bot_logs(level);
CREATE INDEX idx_bot_logs_category ON bot_logs(category);
CREATE INDEX idx_bot_logs_created ON bot_logs(created_at DESC);
