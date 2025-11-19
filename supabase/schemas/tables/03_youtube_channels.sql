-- YouTube Channels Table
-- Stores connected YouTube channels with OAuth credentials

CREATE TABLE IF NOT EXISTS youtube_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id text NOT NULL UNIQUE,
    title text,
    thumbnail_url text,
    subscriber_count integer DEFAULT 0,
    access_token_encrypted text,
    refresh_token_encrypted text,
    token_expires_at timestamptz,
    sync_status text DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
    last_synced_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_youtube_channels_user_id ON youtube_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_channel_id ON youtube_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_sync_status ON youtube_channels(sync_status);

-- RLS Policies
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own channels"
    ON youtube_channels FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own channels"
    ON youtube_channels FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channels"
    ON youtube_channels FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channels"
    ON youtube_channels FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_youtube_channels_updated_at
    BEFORE UPDATE ON youtube_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
