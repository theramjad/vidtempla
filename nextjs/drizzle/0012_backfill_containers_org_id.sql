-- Backfill containers.organization_id from the user's oldest membership.
--
-- Migration 0008 already backfilled existing rows, but containers created since
-- then via REST/MCP went out without organization_id (the service layer didn't
-- set it). This migration catches those stragglers so the new
-- organization_id-based ownership filter sees every row.
--
-- Rows whose owner has no membership stay NULL; they remain invisible to the
-- REST/MCP layer until the user joins or creates an organization.

UPDATE containers
SET organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM "member"
  ORDER BY user_id, created_at ASC
) m
WHERE containers.user_id = m.user_id
  AND containers.organization_id IS NULL;
