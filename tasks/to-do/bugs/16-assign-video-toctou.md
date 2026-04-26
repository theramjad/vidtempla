# 16: `assignVideo` TOCTOU on `containerId` — second assign overwrites first

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/videos.ts:554` — `if (video.containerId)` check (outside txn)
- `nextjs/src/lib/services/videos.ts:644` — txn opens
- `nextjs/src/lib/services/videos.ts:646` — `FOR UPDATE` lock
- `nextjs/src/lib/services/videos.ts:651` — `update` sets `containerId` without re-reading

## Bug
The "already assigned" check runs *before* the transaction. Inside the txn the row is locked but `containerId` is never re-read before the update overwrites it. Two concurrent assigns to an unassigned video both pass the check, both enter the txn, the second silently overwrites the first. The `videoVariables` insert at line 655 then appends a duplicate set of variable rows.

## Impact
- Race-induced data corruption: variables doubled up under one video
- Silent loss of the first user's intended assignment

## Fix (option A — re-check inside txn)
After `FOR UPDATE`, re-read `containerId` and abort if non-NULL.

## Fix (option B — single SQL atomic, simpler)
```ts
const result = await tx.update(youtubeVideos)
  .set({ containerId: input.containerId })
  .where(and(
    eq(youtubeVideos.id, input.videoId),
    isNull(youtubeVideos.containerId),
  ))
  .returning({ id: youtubeVideos.id });
if (result.length === 0) throw new TRPCError({ code: 'CONFLICT', message: 'Video already assigned' });
```

The `WHERE container_id IS NULL` makes the update atomic — no second-read needed.

## Related
- #15 (plan-limit TOCTOU shares this assign flow)
