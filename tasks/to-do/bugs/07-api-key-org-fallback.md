# 07: `withApiKey` falls back `organizationId ?? userId`

- **Severity:** 🔴 Critical (latent — currently masked, becomes active after #1/#2/#3 fix)
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/api-auth.ts:88`
- `nextjs/src/db/schema.ts:445` — `apiKeys.organizationId` is nullable

## Bug
```ts
return { ..., organizationId: key.organizationId ?? key.userId, ... };
```
Pre-org-migration API keys have NULL `organizationId`; the fallback stuffs a `userId` UUID into an `organizationId` text column.

## Impact
Currently harmless because no consumer reads `ctx.organizationId` (#1, #2, #3 are why). Once those are fixed, this fallback masks the org-scope bug as silent NOT_FOUNDs (a userId UUID will never match a real org id).

## Fix (codex stricter recommendation)
Reject keys with NULL `organizationId` outright; force re-issue.

```diff
+ if (!key.organizationId) {
+   return NextResponse.json(apiError("API_KEY_REISSUE_REQUIRED",
+     "API key is not organization-scoped", "Create a new API key", 401),
+     { status: 401 });
+ }
- return { ..., organizationId: key.organizationId ?? key.userId, ... };
+ return { ..., organizationId: key.organizationId, ... };
```

**Tradeoff:** requires UX flow for pre-org users to re-issue keys.

**Alternative:** backfill `organizationId` on existing api_keys rows via migration (resolve via the key creator's `member` row), then drop the fallback. Less disruptive, no UX change. Pick one.

## Related
- #01, #02, #03 — once those are shipped, this fallback becomes harmful
