-- Video Variables Table
-- Stores variable values for each video-template combination

CREATE TABLE IF NOT EXISTS video_variables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    variable_name text NOT NULL,
    variable_value text,
    variable_type text CHECK (variable_type IN ('text', 'number', 'date', 'url')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(video_id, template_id, variable_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_variables_video_id ON video_variables(video_id);
CREATE INDEX IF NOT EXISTS idx_video_variables_template_id ON video_variables(template_id);

-- RLS Policies
ALTER TABLE video_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view variables for their videos"
    ON video_variables FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM youtube_videos
            JOIN youtube_channels ON youtube_channels.id = youtube_videos.channel_id
            WHERE youtube_videos.id = video_variables.video_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert variables for their videos"
    ON video_variables FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM youtube_videos
            JOIN youtube_channels ON youtube_channels.id = youtube_videos.channel_id
            WHERE youtube_videos.id = video_variables.video_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update variables for their videos"
    ON video_variables FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM youtube_videos
            JOIN youtube_channels ON youtube_channels.id = youtube_videos.channel_id
            WHERE youtube_videos.id = video_variables.video_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete variables for their videos"
    ON video_variables FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM youtube_videos
            JOIN youtube_channels ON youtube_channels.id = youtube_videos.channel_id
            WHERE youtube_videos.id = video_variables.video_id
            AND youtube_channels.user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_video_variables_updated_at
    BEFORE UPDATE ON video_variables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
