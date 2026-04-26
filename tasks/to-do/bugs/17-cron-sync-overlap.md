# 17: Cron sync overlap — two runs can both set `syncStatus="syncing"` and stomp

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/workflows/sync-channel-videos.ts:55-58` — `update().set({ syncStatus: 'syncing' }).where(eq(id))`
- `nextjs/vercel.json:2` — schedules `/api/workflows/scheduled-sync` every 6h

## Bug
Sync writes `syncStatus = 'syncing'` with no read-then-CAS. Two crons fired ~simultaneously (Vercel cron retry, deploy-time double-fire, or cron + manual trigger) both proceed and double-insert/double-update. Drift detection runs twice, history rows attempted twice (the unique `(videoId, versionNumber)` constraint catches some of it but the rest of the work is corrupted).

## Impact
- Double `description_history` insert attempts → exception kills one run halfway
- Drift events recorded twice
- YouTube quota burned twice
- Partial DB state from the failed half

## Fix
Compare-and-set on the status column; skip if no row updated:

```ts
const result = await db.update(youtubeChannels)
  .set({ syncStatus: 'syncing' })
  .where(and(
    eq(youtubeChannels.id, channelId),
    sql`${youtubeChannels.syncStatus} != 'syncing'`,
  ))
  .returning({ id: youtubeChannels.id });
if (result.length === 0) {
  console.log(`Sync already in progress for channel ${channelId}, skipping`);
  return;
}
```

Or use a Postgres advisory lock keyed on channel id.
