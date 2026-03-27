-- Custom migration: create personal organizations for existing users who have no membership
-- This is idempotent — users who already have a member row are skipped.

-- Step 1: Create organizations and memberships for unmigrated users
WITH unmigrated_users AS (
  SELECT u.id AS user_id, u.name, u.email
  FROM "user" u
  LEFT JOIN "member" m ON m.user_id = u.id
  WHERE m.id IS NULL
),
new_orgs AS (
  SELECT
    user_id,
    gen_random_uuid()::text AS org_id,
    COALESCE(NULLIF(name, ''), split_part(email, '@', 1), 'My Organization') AS org_name,
    CONCAT(
      LEFT(
        REGEXP_REPLACE(
          REGEXP_REPLACE(LOWER(split_part(email, '@', 1)), '[^a-z0-9-]', '-', 'g'),
          '-+', '-', 'g'
        ),
        30
      ),
      '-',
      LEFT(gen_random_uuid()::text, 6)
    ) AS slug
  FROM unmigrated_users
),
inserted_orgs AS (
  INSERT INTO "organization" (id, name, slug, created_at)
  SELECT org_id, org_name, slug, NOW()
  FROM new_orgs
  RETURNING id, name
),
inserted_members AS (
  INSERT INTO "member" (id, organization_id, user_id, role, created_at)
  SELECT gen_random_uuid()::text, n.org_id, n.user_id, 'owner', NOW()
  FROM new_orgs n
)
SELECT 1;

-- Step 2: Update resource tables — set organization_id from the user's membership
UPDATE youtube_channels SET organization_id = m.organization_id
FROM "member" m
WHERE youtube_channels.user_id = m.user_id
  AND youtube_channels.organization_id IS NULL;

UPDATE containers SET organization_id = m.organization_id
FROM "member" m
WHERE containers.user_id = m.user_id
  AND containers.organization_id IS NULL;

UPDATE templates SET organization_id = m.organization_id
FROM "member" m
WHERE templates.user_id = m.user_id
  AND templates.organization_id IS NULL;

UPDATE subscriptions SET organization_id = m.organization_id
FROM "member" m
WHERE subscriptions.user_id = m.user_id
  AND subscriptions.organization_id IS NULL;

UPDATE user_credits SET organization_id = m.organization_id
FROM "member" m
WHERE user_credits.user_id = m.user_id
  AND user_credits.organization_id IS NULL;

UPDATE api_keys SET organization_id = m.organization_id
FROM "member" m
WHERE api_keys.user_id = m.user_id
  AND api_keys.organization_id IS NULL;

UPDATE api_request_log SET organization_id = m.organization_id
FROM "member" m
WHERE api_request_log.user_id = m.user_id
  AND api_request_log.organization_id IS NULL;
