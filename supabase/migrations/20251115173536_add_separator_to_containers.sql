-- Add separator column to containers table
-- Default value matches current hardcoded behavior ('\n\n')
ALTER TABLE containers
ADD COLUMN separator text NOT NULL DEFAULT E'\n\n';

-- Add comment explaining the column
COMMENT ON COLUMN containers.separator IS 'Text separator used between templates when building descriptions. Default is two newlines.';
