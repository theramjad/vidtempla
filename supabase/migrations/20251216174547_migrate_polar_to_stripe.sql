-- Migrate from Polar to Stripe subscription management
-- This migration renames polar_* columns to stripe_* to support Stripe integration

-- Step 1: Rename polar_* columns to stripe_* in subscriptions table
ALTER TABLE public.subscriptions
  RENAME COLUMN polar_subscription_id TO stripe_subscription_id;

ALTER TABLE public.subscriptions
  RENAME COLUMN polar_customer_id TO stripe_customer_id;

-- Update index names to reflect Stripe naming
DROP INDEX IF EXISTS idx_subscriptions_polar_subscription_id;
CREATE INDEX idx_subscriptions_stripe_subscription_id
  ON public.subscriptions(stripe_subscription_id);

-- Step 2: Rename polar_* columns to stripe_* in orders table
ALTER TABLE public.orders
  RENAME COLUMN polar_order_id TO stripe_invoice_id;

ALTER TABLE public.orders
  RENAME COLUMN polar_customer_id TO stripe_customer_id;

-- Update index names to reflect Stripe naming
DROP INDEX IF EXISTS idx_orders_polar_order_id;
CREATE INDEX idx_orders_stripe_invoice_id
  ON public.orders(stripe_invoice_id);

-- Step 3: Add optional column for Stripe Checkout session tracking
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Step 4: Update column comments for clarity
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN public.subscriptions.stripe_checkout_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN public.orders.stripe_invoice_id IS 'Stripe invoice ID';
COMMENT ON COLUMN public.orders.stripe_customer_id IS 'Stripe customer ID';
