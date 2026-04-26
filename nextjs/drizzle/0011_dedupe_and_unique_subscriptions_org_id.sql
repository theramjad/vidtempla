-- Dedupe duplicate subscription rows per organization, keeping the most recent.
-- Migration 0006 dropped subscriptions_user_id_unique without a replacement, so
-- the user.create.after hook (and any other insert path) can produce duplicates
-- on retry. We delete older duplicates per organization here so the partial
-- unique index added in the next migration (0012) can be created safely.
DELETE FROM subscriptions s1
USING subscriptions s2
WHERE s1.organization_id = s2.organization_id
  AND s1.organization_id IS NOT NULL
  AND s1.created_at < s2.created_at;
