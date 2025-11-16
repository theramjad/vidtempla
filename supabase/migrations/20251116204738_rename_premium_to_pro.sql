-- Migration: Rename 'premium' plan tier to 'pro'
-- This updates the subscriptions table to use 'pro' instead of 'premium'

-- Step 1: Update existing 'premium' records to 'pro'
UPDATE public.subscriptions
SET plan_tier = 'pro'
WHERE plan_tier = 'premium';

-- Step 2: Drop the old CHECK constraint
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_plan_tier_check;

-- Step 3: Add the new CHECK constraint with 'pro' instead of 'premium'
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_plan_tier_check
CHECK (plan_tier IN ('free', 'pro', 'business'));
