-- Custom migration: backfill api_keys.organization_id for any rows still NULL.
--
-- Pre-org-migration API keys (created before 0008) had NULL organization_id, and
-- 0008 backfilled most of them. This migration is the safety net for any keys
-- that slipped through — e.g. keys created via legacy code paths between 0008
-- and the org-isolation cluster (#01/#02/#03) shipping, or rows whose member
-- row was inserted after 0008 ran in a given environment.
--
-- For each api_keys row with NULL organization_id, set it to the organization
-- of the user's OLDEST membership (DISTINCT ON ordered by created_at ASC,
-- then id ASC to break timestamp ties deterministically).
-- This matches the heuristic the templates/containers backfills use elsewhere
-- and resolves multi-org users deterministically to their original/personal org.
--
-- Idempotent: rows that already have organization_id set are untouched. Rows
-- whose user has no membership at all (orphaned keys post-account-deletion)
-- remain NULL and will be rejected by withApiKey()'s 401 guard.

UPDATE api_keys
SET organization_id = sub.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM "member"
  ORDER BY user_id, created_at ASC, id ASC
) AS sub
WHERE api_keys.user_id = sub.user_id
  AND api_keys.organization_id IS NULL;
