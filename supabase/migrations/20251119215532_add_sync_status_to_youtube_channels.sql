-- Add sync_status column to youtube_channels table
-- This tracks the current sync state: 'idle', 'syncing', 'error'

ALTER TABLE youtube_channels
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error'));

-- Add index for efficient filtering by sync status
CREATE INDEX IF NOT EXISTS idx_youtube_channels_sync_status ON youtube_channels(sync_status);

-- Update the schema file reference
COMMENT ON COLUMN youtube_channels.sync_status IS 'Current sync status: idle, syncing, or error';
