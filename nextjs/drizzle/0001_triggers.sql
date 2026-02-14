-- Custom triggers migration
-- These triggers replicate the Supabase triggers in the new PlanetScale Postgres DB

-- 1. update_updated_at_column() — auto-update updated_at on all main tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_youtube_channels_updated_at
  BEFORE UPDATE ON youtube_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_containers_updated_at
  BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_youtube_videos_updated_at
  BEFORE UPDATE ON youtube_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_variables_updated_at
  BEFORE UPDATE ON video_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. prevent_container_reassignment() — once container_id is set on youtube_videos, it cannot be changed
CREATE OR REPLACE FUNCTION prevent_container_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.container_id IS NOT NULL AND NEW.container_id IS DISTINCT FROM OLD.container_id THEN
    RAISE EXCEPTION 'Cannot reassign a video to a different container. Remove it first, then assign to a new container.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_video_container_reassignment
  BEFORE UPDATE ON youtube_videos
  FOR EACH ROW EXECUTE FUNCTION prevent_container_reassignment();

-- 3. set_next_version_number() — auto-increment version_number in description_history per video
CREATE OR REPLACE FUNCTION set_next_version_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
  FROM description_history
  WHERE video_id = NEW.video_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_description_history_version
  BEFORE INSERT ON description_history
  FOR EACH ROW EXECUTE FUNCTION set_next_version_number();
