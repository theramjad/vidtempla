# 26: `subscription.deleted` doesn't clear `stripeSubscriptionId`

- **Severity:** 🟡 Medium (mitigated)
- **Verified:** Claude exploratory ✓ · Claude verifier ⚠️ partial · Codex gpt-5.5 ⚠️ partial

## Files
- `nextjs/src/app/api/webhooks/stripe/route.ts:237-242` — sets only `status: "canceled"`, `planTier: "free"`
- `nextjs/src/server/api/routers/dashboard/billing.ts:311-316` — would route to `stripe.subscriptions.update` if non-null
- Mitigation: `billing.ts:319` `status !== "active"` guard blocks the bad path

## Bug
On cancellation, only `status` and `planTier` are updated. `stripeSubscriptionId`, `cancelAtPeriodEnd`, period fields are left dirty. If any future code path reads `stripeSubscriptionId` without checking `status`, it will hit Stripe with a deleted subscription ID and 404.

## Impact
Mostly mitigated today by the `status !== 'active'` guard at billing.ts:319 — but fragile. Pricing routes canceled users to a fresh checkout, which avoids the path entirely.

## Fix
Clear all subscription-specific fields on `customer.subscription.deleted`; keep `stripeCustomerId` so the user keeps their Stripe profile for re-subscribe.

```diff
  await db.update(subscriptions).set({
    status: "canceled",
    planTier: "free",
+   stripeSubscriptionId: null,
+   cancelAtPeriodEnd: false,
+   currentPeriodStart: null,
+   currentPeriodEnd: null,
  }).where(...);
```
