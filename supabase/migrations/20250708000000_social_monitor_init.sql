-- ============================================================================
-- Social Media Monitor - Complete Database Schema
-- Generated on 2025-07-08
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- TWITTER MONITORING TABLES
-- ============================================================================

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

-- Tweets table
CREATE TABLE IF NOT EXISTS public.tweets (
  id BIGINT PRIMARY KEY,                     -- Tweet id (snowflake)
  account_id BIGINT NOT NULL REFERENCES public.twitter_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,          -- original tweet timestamp (UTC)
  thread_id BIGINT,                         -- conversation_id_str
  in_reply_to_id BIGINT,                    -- parent tweet id (nullable)
  text TEXT NOT NULL,
  expanded_urls JSONB,                      -- [ {url, expanded, display}, ... ]
  media JSONB,                              -- [ {url, type, alt}, ... ]
  raw_payload JSONB,                        -- full tweet JSON for future re-parsing
  retweet_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Twitter accounts indexes
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_username ON public.twitter_accounts (username);
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_created_at ON public.twitter_accounts (created_at DESC);

-- Tweets indexes
CREATE INDEX IF NOT EXISTS idx_tweets_account_created_at ON public.tweets (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_thread_id ON public.tweets (thread_id);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON public.tweets (created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.twitter_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tweets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Twitter accounts policies
CREATE POLICY "Authenticated users can view twitter accounts" ON public.twitter_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage twitter accounts" ON public.twitter_accounts
  FOR ALL TO authenticated USING (true);

-- Tweets policies
CREATE POLICY "Authenticated users can view tweets" ON public.tweets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tweets" ON public.tweets
  FOR ALL TO authenticated USING (true);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamps

CREATE TRIGGER update_twitter_accounts_updated_at
  BEFORE UPDATE ON public.twitter_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();