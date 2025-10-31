-- Add OAuth token storage to stream_notifications
ALTER TABLE stream_notifications ADD COLUMN IF NOT EXISTS oauth_access_token text;
ALTER TABLE stream_notifications ADD COLUMN IF NOT EXISTS oauth_refresh_token text;
ALTER TABLE stream_notifications ADD COLUMN IF NOT EXISTS oauth_token_expires_at timestamp;
ALTER TABLE stream_notifications ADD COLUMN IF NOT EXISTS is_oauth_verified boolean DEFAULT false;
ALTER TABLE stream_notifications ADD COLUMN IF NOT EXISTS oauth_verified_at timestamp;

-- Create an index for quick lookups of OAuth-verified streamers
CREATE INDEX IF NOT EXISTS idx_stream_oauth_verified ON stream_notifications(is_oauth_verified, platform) WHERE is_oauth_verified = true;

-- Create a table to temporarily store OAuth state for security
CREATE TABLE IF NOT EXISTS oauth_states (
  state varchar(255) PRIMARY KEY,
  user_id varchar(255) NOT NULL,
  platform varchar(50) NOT NULL,
  guild_id varchar(255),
  created_at timestamp DEFAULT NOW(),
  expires_at timestamp DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Index for cleanup of expired states
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
