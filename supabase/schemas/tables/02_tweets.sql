-- ============================================================================
-- Tweets Table Schema
-- ============================================================================

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_account_created_at ON public.tweets (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_thread_id ON public.tweets (thread_id);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON public.tweets (created_at DESC);

-- Enable RLS
ALTER TABLE public.tweets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view tweets" ON public.tweets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tweets" ON public.tweets
  FOR ALL TO authenticated USING (true);
