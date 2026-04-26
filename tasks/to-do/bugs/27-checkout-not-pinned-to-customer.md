# 27: Stripe Checkout passes `customer_email`, never `customer:` ID

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/server/api/routers/dashboard/billing.ts:95-120` (especially line 106)

## Bug
`stripe.checkout.sessions.create` is called with `customer_email: ctx.user.email` only — never `customer: subscription.stripeCustomerId`. The `subscription` row already fetched at lines 74-92 has `stripeCustomerId` if the user previously subscribed.

## Impact
- Each new checkout creates a fresh Stripe customer per org (one user → many Stripe customers)
- Broken `getCustomerPortalUrl` lookups (mismatch on `stripeCustomerId`)
- Messy Stripe dashboard
- Webhook matching by `stripeCustomerId` becomes ambiguous

## Fix
Pass `customer:` when present, fall back to `customer_email` for first-time checkouts:

```diff
  const session = await stripe.checkout.sessions.create({
-   customer_email: ctx.user.email,
+   ...(subscription?.stripeCustomerId
+     ? { customer: subscription.stripeCustomerId }
+     : { customer_email: ctx.user.email }),
    line_items: [...],
    ...
  });
```

## Related
- #26 (the cancel-then-rebuy path is the most common trigger)
