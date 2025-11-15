-- Drop Twitter-related tables
-- This migration removes all Twitter functionality from the database

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.tweets CASCADE;
DROP TABLE IF EXISTS public.twitter_accounts CASCADE;

-- Drop any remaining functions/triggers related to Twitter
DROP FUNCTION IF EXISTS update_twitter_accounts_updated_at() CASCADE;
