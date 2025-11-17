-- Remove variable_type column from video_variables table
-- All variables are now just text type

ALTER TABLE video_variables DROP COLUMN IF EXISTS variable_type;
