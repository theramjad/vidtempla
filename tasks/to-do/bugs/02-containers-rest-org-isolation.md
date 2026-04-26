# 02: REST containers filter by `userId`, not `organizationId`

- **Severity:** 🔴 Critical
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/containers.ts` lines 16, 39, 66, 104, 107, 142, 169, 195
- REST handlers under `nextjs/src/app/api/v1/containers/`

## Bug
Same pattern as #01 — every query filters `eq(containers.userId, userId)` even though `containers` has `organizationId` (`schema.ts:172`). `createContainer` (line 104/107) doesn't set `organizationId` on insert.

## Impact
Teammates can't see each other's containers via REST/MCP. Ex-members keep mutation rights.

## Fix
Same shape as #01 — backfill migration + thread `auth.organizationId` + swap WHERE clauses + set `organizationId` on insert.

```diff
- const filters = [eq(containers.userId, userId)];
+ const filters = [eq(containers.organizationId, organizationId)];

- .values({ userId, ... })
+ .values({ userId, organizationId, ... })
```

## Related
- #01, #03, #07, #34
