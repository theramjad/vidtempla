# 12: MCP handler trusts stale `activeOrganizationId` without re-checking membership

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/app/api/mcp/route.ts:27-36` (read), `:55` (use)

## Bug
```ts
const organizationId = latestSession.activeOrganizationId;
// ... runs MCP tools with organizationId, no member check
```
The fallback at lines 39-46 only runs when `activeOrganizationId IS NULL`. When set, it's trusted directly. A user removed from an org but with a still-valid session row keeps MCP access.

## Impact
Removed members retain full MCP read/write access to the org until their session expires.

## Fix
Verify `member` row exists for `(userId, activeOrganizationId)` before trusting; fall through to the existing fallback if not:

```ts
const m = await db.select().from(member)
  .where(and(
    eq(member.userId, latestSession.userId),
    eq(member.organizationId, latestSession.activeOrganizationId)
  ))
  .limit(1);
if (m.length === 0) {
  // fall through to fallback (lines 39-46)
} else {
  organizationId = latestSession.activeOrganizationId;
}
```
