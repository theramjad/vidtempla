# 23: REST envelope meta-keys violate documented contract on YouTube proxies

- **Severity:** 🟡 Medium (codex pulled to PARTIAL — top-level envelope is fine)
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ⚠️ partial

## Files
- `nextjs/src/app/api/v1/youtube/playlists/route.ts:62-67`
- `nextjs/src/app/api/v1/youtube/playlists/[id]/items/route.ts:66-72`
- `nextjs/src/app/api/v1/youtube/comments/[id]/route.ts:81-87`
- **Contract:** `nextjs/src/app/api/v1/CLAUDE.md:55` — documents `meta: { cursor, hasMore, total }`

## Bug
Top-level `apiSuccess(...)` envelope is correct (and docs do allow `data` to be a bare array). Only the `meta` keys violate: returns `{ quotaUnits, pageInfo, nextPageToken }` instead of `{ cursor, hasMore, total }`.

## Impact
Agents written to the documented contract have to special-case YouTube proxy endpoints. Universal pagination loops break.

## Fix
Normalize meta:

```diff
- meta: { quotaUnits, pageInfo, nextPageToken }
+ meta: {
+   cursor: nextPageToken ?? null,
+   hasMore: Boolean(nextPageToken),
+   total: pageInfo?.totalResults ?? null,
+   quotaUnits,  // keep only if contract permits extra keys
+ }
```

Add `quotaUnits` to the contract doc if you want to keep it as a documented extension.
