-- Migration: YouTube Description Updater Initial Schema
-- This migration creates all tables needed for the YouTube description management system

-- YouTube Channels Table
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
    last_synced_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_user_id ON youtube_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_channel_id ON youtube_channels(channel_id);

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

CREATE TRIGGER update_youtube_channels_updated_at
    BEFORE UPDATE ON youtube_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Containers Table
CREATE TABLE IF NOT EXISTS containers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    template_order uuid[] DEFAULT ARRAY[]::uuid[],
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_containers_user_id ON containers(user_id);

ALTER TABLE containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own containers"
    ON containers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own containers"
    ON containers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own containers"
    ON containers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own containers"
    ON containers FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER update_containers_updated_at
    BEFORE UPDATE ON containers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
    ON templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
    ON templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
    ON templates FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
    ON templates FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- YouTube Videos Table
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

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_id ON youtube_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_container_id ON youtube_videos(container_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON youtube_videos(video_id);

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

CREATE TRIGGER enforce_immutable_container
    BEFORE UPDATE ON youtube_videos
    FOR EACH ROW
    EXECUTE FUNCTION prevent_container_reassignment();

-- Video Variables Table
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

CREATE INDEX IF NOT EXISTS idx_video_variables_video_id ON video_variables(video_id);
CREATE INDEX IF NOT EXISTS idx_video_variables_template_id ON video_variables(template_id);

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

CREATE TRIGGER update_video_variables_updated_at
    BEFORE UPDATE ON video_variables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Description History Table
CREATE TABLE IF NOT EXISTS description_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
    description text NOT NULL,
    version_number integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_description_history_video_id_created_at ON description_history(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_description_history_video_id_version ON description_history(video_id, version_number);

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
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO NEW.version_number
    FROM description_history
    WHERE video_id = NEW.video_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_version_number
    BEFORE INSERT ON description_history
    FOR EACH ROW
    EXECUTE FUNCTION set_next_version_number();
