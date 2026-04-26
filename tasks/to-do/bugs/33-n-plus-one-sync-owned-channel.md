# 33: N+1 queries in `syncOwnedChannelVideos` — 3 round-trips per video

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/videos.ts:86-134` (the N+1)
- **Reference (correct pattern):** `nextjs/src/workflows/sync-channel-videos.ts:188-196` — batches via `inArray` + `Map`

## Bug
For each video in the YouTube response:
1. Per-video `SELECT { id } FROM youtube_videos WHERE videoId = v.id` (line 87)
2. Per-video `UPDATE` (line 115)
3. Per-mismatch fresh `db.transaction` for drift (line 130)

3 round-trips minimum per video. Compounds the latency from #18 (sync-on-every-list).

## Impact
- Slow list responses on channels with many videos
- Stacks with #18 to make REST list calls extremely slow during sync
- DB connection pool pressure

## Fix
Copy the batched pattern from `sync-channel-videos.ts:188-196`:

```ts
const videoIds = ytVideos.map((v) => v.id);
const existing = await db.select()
  .from(youtubeVideos)
  .where(inArray(youtubeVideos.videoId, videoIds));
const byId = new Map(existing.map((v) => [v.videoId, v]));

await db.transaction(async (tx) => {
  for (const v of ytVideos) {
    const e = byId.get(v.id);
    if (!e) {
      // batch insert candidates
    } else if (driftDetected(e, v)) {
      // batch update candidates
    }
  }
  // single batched insert + single batched update per page
});
```

One transaction per page, not per video.
