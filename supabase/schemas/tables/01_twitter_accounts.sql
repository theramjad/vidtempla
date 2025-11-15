-- ============================================================================
-- Twitter Accounts Table Schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Twitter accounts table
CREATE TABLE IF NOT EXISTS public.twitter_accounts (
  id BIGINT PRIMARY KEY,                     -- Twitter user_id (snowflake)
  username TEXT NOT NULL UNIQUE,            -- @handle (lower-case preferred)
  display_name TEXT,                        -- e.g. "Anthropic"
  profile_image_url TEXT,                   -- avatar URL (highest-res if possible)
  followers_count INTEGER DEFAULT 0,        -- snapshot at last crawl
  last_seen_at TIMESTAMPTZ,                 -- most recent tweet we ingested
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_username ON public.twitter_accounts (username);
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_created_at ON public.twitter_accounts (created_at DESC);

-- Enable RLS
ALTER TABLE public.twitter_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view twitter accounts" ON public.twitter_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage twitter accounts" ON public.twitter_accounts
  FOR ALL TO authenticated USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at timestamp
CREATE TRIGGER update_twitter_accounts_updated_at
  BEFORE UPDATE ON public.twitter_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
