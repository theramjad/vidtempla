# 10: Cron secret bypass when `CRON_SECRET` env var is unset/empty

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/app/api/workflows/scheduled-sync/route.ts:7-12`
- `nextjs/src/app/api/workflows/credit-reset/route.ts:7-12`

## Bug
```ts
if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new NextResponse("Unauthorized", { status: 401 });
}
```
If `CRON_SECRET` is unset or empty, the `&&` short-circuits and the guard is skipped — unauthenticated requests pass. Comparison is also `!==` (not constant-time).

## Impact
Anyone can trigger `scheduledSyncWorkflow` (mass YouTube quota burn across every channel) or `creditResetWorkflow` if the secret is ever rotated to empty / unset on a deploy.

## Fix
Fail closed when missing; constant-time compare:

```ts
const expected = process.env.CRON_SECRET;
if (!expected) {
  return new NextResponse("Cron not configured", { status: 500 });
}
const got = authHeader?.replace(/^Bearer /, "") ?? "";
const a = Buffer.from(got);
const b = Buffer.from(expected);
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return new NextResponse("Unauthorized", { status: 401 });
}
```
