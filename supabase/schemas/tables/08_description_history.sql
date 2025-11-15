-- Description History Table
-- Tracks all description changes with version numbers

CREATE TABLE IF NOT EXISTS description_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
    description text NOT NULL,
    version_number integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_description_history_video_id_created_at ON description_history(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_description_history_video_id_version ON description_history(video_id, version_number);

-- RLS Policies
ALTER TABLE description_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history for their videos"
    ON description_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM youtube_videos
            JOIN youtube_channels ON youtube_channels.id = youtube_videos.channel_id
            WHERE youtube_videos.id = description_history.video_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert history for their videos"
    ON description_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM youtube_videos
            JOIN youtube_channels ON youtube_channels.id = youtube_videos.channel_id
            WHERE youtube_videos.id = description_history.video_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

-- Function to auto-increment version number
CREATE OR REPLACE FUNCTION set_next_version_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Get the max version number for this video and add 1
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO NEW.version_number
    FROM description_history
    WHERE video_id = NEW.video_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set version number before insert
CREATE TRIGGER auto_set_version_number
    BEFORE INSERT ON description_history
    FOR EACH ROW
    EXECUTE FUNCTION set_next_version_number();
