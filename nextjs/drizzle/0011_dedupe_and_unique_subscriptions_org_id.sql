-- Dedupe duplicate subscription rows per organization, keeping the best row.
-- Migration 0006 dropped subscriptions_user_id_unique without a replacement, so
-- the user.create.after hook (and any other insert path) can produce duplicates
-- on retry. We delete duplicates per organization here so the partial unique
-- index added in the next migration (0012) can be created safely. Prefer rows
-- with billing data, then the most recent row, then a deterministic id tie-break.
WITH ranked_subscriptions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY
        CASE
          WHEN stripe_subscription_id IS NOT NULL
            OR stripe_customer_id IS NOT NULL
            OR stripe_checkout_session_id IS NOT NULL
            OR plan_tier <> 'free'
          THEN 0
          ELSE 1
        END,
        created_at DESC,
        id DESC
    ) AS row_number
  FROM subscriptions
  WHERE organization_id IS NOT NULL
)
DELETE FROM subscriptions
USING ranked_subscriptions
WHERE subscriptions.id = ranked_subscriptions.id
  AND ranked_subscriptions.row_number > 1;
