# 03: YouTube proxy routes drop `organizationId` from `getChannelTokens`

- **Severity:** 🔴 Critical
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- All routes under `nextjs/src/app/api/v1/youtube/{captions,playlists,comments,thumbnails,search}/**/route.ts`
- **Also (codex-flagged):** `nextjs/src/lib/services/analytics.ts:182` — service helper has the same bug
- `nextjs/src/lib/api-auth.ts:179` — helper signature accepts and prefers `organizationId`

## Bug
Every route calls `getChannelTokens(channelId, ctx.userId)` without `organizationId`. The helper supports `organizationId` as a third arg and prefers it when given. `youtubeChannels` table has both columns. `searchYouTube` and analytics service wrappers have the same bug — fix must extend through service wrappers, not just routes.

## Impact
Org members other than the original channel-connector get `CHANNEL_NOT_FOUND`. Ex-members retain proxy access (post comments, change thumbnails, write captions) on org channels they originally connected.

## Fix
Add `ctx.organizationId` as the third arg in every `getChannelTokens` call, both in route handlers and in service helpers (`analytics.ts:182`, `searchYouTube`).

```diff
- const tokens = await getChannelTokens(channelId, ctx.userId);
+ const tokens = await getChannelTokens(channelId, ctx.userId, ctx.organizationId);
```

## Related
- #01, #02, #07
