# 13: `subscriptions` table has zero uniqueness on `userId` or `organizationId`

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/drizzle/0006_young_korg.sql:29` — drops `subscriptions_user_id_unique`
- `nextjs/src/db/schema.ts:331-358` — only `stripeSubscriptionId.unique()` (nullable)
- `nextjs/src/lib/auth.ts:33-77` — Better Auth `user.create.after` hook inserts subscriptions

## Bug
Migration 0006 dropped the per-user unique constraint and no replacement was added. The `user.create.after` hook inserts into `subscriptions` without an upsert; retries can create duplicates. Code like `getUserPlanTier` then destructures `[subscription]` and picks arbitrarily.

## Impact
- Hook retry → duplicate subscription rows
- `getUserPlanTier` returns nondeterministic results
- Stripe events that match by `stripeCustomerId` can land on the wrong row

## Fix
1. Dedupe existing rows (SQL: keep the most recent per `organizationId`, delete the rest)
2. Add `uniqueIndex('subscriptions_org_id_unique').on(subscriptions.organizationId)` once `organization_id` is backfilled and notNull
3. Make creation paths idempotent: change the `user.create.after` insert to `onConflictDoNothing` keyed on `organizationId`

## Related
- #01, #02 (org backfill cluster) — needs to land first so `organization_id` is reliably populated
