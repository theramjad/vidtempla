# 34: `containers.ts` selects videos before ownership check — leaks drift metadata

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ⚠️ partial · Codex gpt-5.5 ✓ (sharpened — flagged the SELECT, not the UPDATE)

## Files
- `nextjs/src/lib/services/containers.ts:139` — the unscoped SELECT
- `nextjs/src/lib/services/containers.ts:166` — the ownership check happens AFTER

## Bug
```ts
const videos = await db.select().from(youtubeVideos)
  .where(eq(youtubeVideos.containerId, id));  // line 139 — no user/org filter
// ...
// ownership check at line 166 (too late)
```
The video SELECT happens before the container's ownership is verified. Drift metadata for foreign containers is leaked through the response even though the eventual UPDATE is gated.

## Impact
- An attacker who guesses or harvests a `containerId` from another user/org gets that container's video drift metadata
- Same class as #08 but for the containers service
- Effectively safe today only because the response shape is internal — fragile

## Fix
Verify container belongs to the caller *before* selecting videos:

```ts
const [container] = await db.select({ id: containers.id })
  .from(containers)
  .where(and(
    eq(containers.id, id),
    eq(containers.organizationId, organizationId),  // after #02 fix
  ))
  .limit(1);
if (!container) throw new TRPCError({ code: 'NOT_FOUND' });
// ... now safe to select videos
```

## Related
- #02 (containers org isolation — must land first so we can filter by `organizationId`)
- #08 (same class of leak in `getAffectedVideos`)
