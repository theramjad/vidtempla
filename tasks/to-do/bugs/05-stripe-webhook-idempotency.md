# 05: Stripe webhook idempotency broken — handlers re-run on every redelivery

- **Severity:** 🔴 Critical
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/app/api/webhooks/stripe/route.ts:60-72` (upsert), `:75` (switch)

## Bug
`onConflictDoUpdate` resets `processed: false` on conflict and there is no `if (existing.processed)` guard before the handler `switch`. Every Stripe redelivery (retry, manual replay, network blip) re-runs handlers.

## Impact
Combined with #04 → duplicate credit allocations on every retry/redelivery. Combined with email-sending handlers → duplicate notifications.

## Fix
SELECT-then-guard *before* the upsert:

```diff
+ const [existing] = await db.select({ processed: webhookEvents.processed })
+   .from(webhookEvents).where(eq(webhookEvents.eventId, event.id)).limit(1);
+ if (existing?.processed) return NextResponse.json({ received: true, duplicate: true });
```

Then change the upsert to `onConflictDoNothing` (or just `INSERT ... ON CONFLICT (event_id) DO NOTHING`) — never reset `processed`.

## Related
- #04, #06
