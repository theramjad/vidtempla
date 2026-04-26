# 18: `syncOwnedChannelVideos` runs on every public REST list call

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/videos.ts:192-194` — invokes sync on every list with `channelId`
- `nextjs/src/lib/services/videos.ts:83+` — sync function fetches YouTube pages immediately, no cache

## Bug
```ts
if (opts.channelId) {
  isOwned = await syncOwnedChannelVideos(opts.channelId, userId, organizationId);
}
```
No cache. No `lastSyncedAt` gate. No `syncStatus` check (so this also overlaps with the cron from #17). `listVideos` is the public REST endpoint — every agent call with a channelId triggers a full YouTube uploads pagination.

## Impact
- YouTube quota burn (each call paginates the entire uploads playlist)
- Latency spike on every list call
- Stacks with #17 — REST + cron can both be syncing simultaneously

## Fix
Throttle by `lastSyncedAt`:

```ts
const channel = await db.select({ lastSyncedAt: youtubeChannels.lastSyncedAt })
  .from(youtubeChannels)
  .where(eq(youtubeChannels.id, channelId))
  .limit(1);
const stale = !channel[0]?.lastSyncedAt ||
  Date.now() - channel[0].lastSyncedAt.getTime() > 5 * 60 * 1000;
if (stale && opts.channelId) {
  // Enqueue async, don't block the list response
  await enqueueSync(channelId);
}
```

Better: serve cached DB data on list, sync only via cron + manual trigger.

## Related
- #17 (cron overlap protection should be the same lock used here)
