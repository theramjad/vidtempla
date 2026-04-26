# 04: `upsertCredits` resets balance on every Stripe sub update

- **Severity:** 🔴 Critical
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/plan-limits.ts:283-286` — `upsertCredits` `onConflictDoUpdate` sets `balance: allocation` unconditionally
- `nextjs/src/app/api/webhooks/stripe/route.ts:222` — calls `upsertCredits` from `handleSubscriptionUpdate`
- `nextjs/src/app/api/webhooks/stripe/route.ts:80` — `customer.subscription.updated` routes to `handleSubscriptionUpdate`

## Bug
`onConflictDoUpdate({ target: userCredits.organizationId, set: { balance: allocation, ... } })` runs on every `customer.subscription.updated` webhook. Stripe fires this event for card changes, prorations, metadata edits — any benign update silently refills the user's balance to `allocation`.

## Impact
**Money/trust risk.** Users can refill depleted credits free by triggering any benign sub update (e.g., updating payment method).

## Fix
On conflict, only update `monthlyAllocation`/`periodStart`/`periodEnd`. Reset `balance` only on period rollover (when `periodStart` changes) or inside `customer.subscription.created`.

```diff
- await handleSubscriptionUpdate(event.data.object as StripeSubscriptionWithPeriods);
+ await handleSubscriptionUpdate(event.data.object as StripeSubscriptionWithPeriods,
+   event.type !== "customer.subscription.updated");

- await upsertCredits(orgId, allocation, periodStart, periodEnd);
+ if (resetCredits) await upsertCredits(orgId, allocation, periodStart, periodEnd);
```

Or in `upsertCredits` itself: only set `balance` on conflict when `periodStart` differs from the existing row's `periodStart`.

## Related
- #05 (idempotency — current bug means even *one* legitimate update fires the reset)
