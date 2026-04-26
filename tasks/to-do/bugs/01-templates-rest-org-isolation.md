# 01: REST templates filter by `userId`, not `organizationId`

- **Severity:** 🔴 Critical
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/templates.ts` lines 17, 40, 63, 89, 118, 158, 184, 207, 216
- REST handlers under `nextjs/src/app/api/v1/templates/` — pass only `auth.userId` to the service

## Bug
Every query uses `eq(templates.userId, userId)` even though `templates` is org-scoped (`schema.ts:190`, nullable). `createTemplate` (line 89) also never sets `organizationId` on insert — new rows are NULL.

## Impact
Teammates hit `TEMPLATE_NOT_FOUND` on templates created by other org members. Ex-members keep update/delete rights via API key. Existing rows have NULL `organizationId` so a backfill is required before the WHERE-clause fix can work end-to-end.

## Fix
1. **Backfill migration** for existing `templates` rows where `organization_id IS NULL` (resolve via the `member` table; handle multi-membership users — pick the active org from the creator's session if available, otherwise the oldest membership)
2. Thread `auth.organizationId` through service signatures
3. Replace `userId` filters with `organizationId` filters
4. Set `organizationId` in every `createTemplate` insert path

```diff
- const filters = [eq(templates.userId, userId)];
+ const filters = [eq(templates.organizationId, organizationId)];

- .values({ userId, name: name.trim(), content })
+ .values({ userId, organizationId, name: name.trim(), content })
```

## Related
- #02 (containers — same pattern)
- #03 (YouTube proxies — same pattern)
- #07 (`withApiKey` org fallback masks this bug today)
