-- YouTube Videos Table
-- Stores video information and container assignment

CREATE TABLE IF NOT EXISTS youtube_videos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
    video_id text NOT NULL UNIQUE,
    title text,
    current_description text,
    container_id uuid REFERENCES containers(id) ON DELETE SET NULL,
    published_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_id ON youtube_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_container_id ON youtube_videos(container_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON youtube_videos(video_id);

-- RLS Policies
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view videos from their channels"
    ON youtube_videos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM youtube_channels
            WHERE youtube_channels.id = youtube_videos.channel_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert videos to their channels"
    ON youtube_videos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM youtube_channels
            WHERE youtube_channels.id = youtube_videos.channel_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their videos"
    ON youtube_videos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM youtube_channels
            WHERE youtube_channels.id = youtube_videos.channel_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their videos"
    ON youtube_videos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM youtube_channels
            WHERE youtube_channels.id = youtube_videos.channel_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_youtube_videos_updated_at
    BEFORE UPDATE ON youtube_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to prevent container_id changes once set
CREATE OR REPLACE FUNCTION prevent_container_reassignment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.container_id IS NOT NULL AND NEW.container_id IS DISTINCT FROM OLD.container_id THEN
        RAISE EXCEPTION 'Cannot change container_id once it has been set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutable container assignment
CREATE TRIGGER enforce_immutable_container
    BEFORE UPDATE ON youtube_videos
    FOR EACH ROW
    EXECUTE FUNCTION prevent_container_reassignment();
