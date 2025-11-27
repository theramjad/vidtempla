-- Add token_status column to youtube_channels
-- Tracks whether OAuth tokens are valid or need re-authentication

ALTER TABLE youtube_channels
ADD COLUMN IF NOT EXISTS token_status text DEFAULT 'valid' CHECK (token_status IN ('valid', 'invalid'));
