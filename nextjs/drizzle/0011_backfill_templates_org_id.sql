-- Backfill templates.organization_id for rows where it is NULL.
--
-- The earlier migration (0008_migrate_existing_users_to_orgs.sql) backfilled
-- templates by joining against the member table, but for users with multiple
-- memberships the picked organization was non-deterministic. Additionally,
-- createTemplate did not set organization_id until this PR, so any templates
-- created via the REST API after 0008 ran will still have NULL values.
--
-- For each NULL row, set organization_id to the user's OLDEST membership
-- (smallest created_at). Rows whose user has no membership at all stay NULL.

UPDATE templates
SET organization_id = oldest.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM "member"
  ORDER BY user_id, created_at ASC
) AS oldest
WHERE templates.user_id = oldest.user_id
  AND templates.organization_id IS NULL;
