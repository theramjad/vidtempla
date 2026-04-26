# 09: Destructive billing/API-key mutations use `orgProcedure` (member-tier)

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/server/api/routers/dashboard/billing.ts:56` (`createCheckoutSession`)
- `nextjs/src/server/api/routers/dashboard/billing.ts:290` (`updateSubscription`)
- `nextjs/src/server/api/routers/dashboard/apiKeys.ts:33` (`create`)
- `nextjs/src/server/api/routers/dashboard/apiKeys.ts:74` (`revoke`)
- `nextjs/src/server/trpc/init.ts:80-86` — `orgAdminProcedure` already exists, gates on `role IN ('owner', 'admin')`

## Bug
All four destructive mutations use `orgProcedure` (any org member) instead of `orgAdminProcedure` (owner/admin only).

## Impact
Any viewer-tier member can:
- Downgrade the org's plan (`updateSubscription`)
- Mint org-wide API keys (`apiKeys.create`)
- Revoke the owner's API keys (`apiKeys.revoke`)
- Initiate Stripe checkout (`createCheckoutSession`)

## Fix
One-line swap on each procedure. No new infrastructure needed.

```diff
- export const createCheckoutSession = orgProcedure
+ export const createCheckoutSession = orgAdminProcedure
```

Also audit the customer portal endpoint and any other billing-side procedure for the same pattern (codex flagged "likely billing portal").
