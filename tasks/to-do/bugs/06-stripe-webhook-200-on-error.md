# 06: Stripe webhook returns 200 on internal error — kills retries

- **Severity:** 🔴 Critical
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/app/api/webhooks/stripe/route.ts:118-119`

## Bug
Catch block returns `NextResponse.json({ error: "Internal error" }, { status: 200 })` with the comment "Return 200 to prevent Stripe from retrying."

## Impact
Kills Stripe's retry safety net. A transient DB outage during `handleSubscriptionUpdate` permanently loses the subscription state sync — paying user can be stuck on free tier (or vice versa) with no automatic reconciliation.

## Fix
Return 500 from the catch block. Stripe will retry with exponential backoff. The idempotency guard from #05 prevents double-processing once #05 is fixed.

```diff
- return NextResponse.json({ error: "Internal error" }, { status: 200 });
+ return NextResponse.json({ error: "Internal error" }, { status: 500 });
```

**Order matters:** ship #05 (idempotency guard) *before* this fix, otherwise any handler that's already partially-applied state will be re-run on the retry.

## Related
- #05 (must ship first)
