-- Add streaming XP tracking columns to server_members table
ALTER TABLE server_members
ADD COLUMN IF NOT EXISTS stream_xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS stream_time INTEGER DEFAULT 0;

-- Create index for streaming level lookups
CREATE INDEX IF NOT EXISTS idx_server_members_stream_level 
ON server_members(server_id, stream_level DESC);
