# Description Drift Detection

## Context

When users edit video descriptions directly in YouTube Studio, VidTempla doesn't detect the change. The next time a template or variable changes, VidTempla silently overwrites the manual edit with no warning and no history. This task adds drift detection to sync, archives manual edits, surfaces drift status to agents, and fixes a bug where revert doesn't actually push to YouTube.

## Plan

### Phase 1: Schema Changes

**File:** `nextjs/src/db/schema.ts`

1. Add `source` column to `descriptionHistory` (nullable text, default null):
   - Values: `"initial_sync"` | `"template_push"` | `"manual_youtube_edit"` | `"revert"`
   - Existing rows stay null (predates feature)

2. Add `driftDetectedAt` column to `youtubeVideos` (nullable timestamp with tz):
   - Set to `new Date()` when drift detected during sync
   - Reset to `null` when drift is resolved (template push or revert)

3. Run `npx drizzle-kit generate` to create migration SQL

### Phase 2: Sync Drift Detection

**File:** `nextjs/src/inngest/youtube/syncChannelVideos.ts`

No additional YouTube API calls needed — `fetchChannelVideos` already fetches descriptions for all videos.

- Expand the existing-video query to include `id` and `currentDescription`
- Build a lookup map instead of a Set
- In the existing-video branch: compare `ytVideo.snippet.description` with `currentDescription`
- If different AND `currentDescription` is not null:
  - Create a `descriptionHistory` entry with `source: "manual_youtube_edit"`
  - Update `currentDescription` to match YouTube
  - Set `driftDetectedAt` to now
- Update new-video history entries to include `source: "initial_sync"`

### Phase 3: Template Push Updates

**File:** `nextjs/src/inngest/youtube/updateVideoDescriptions.ts`

- Add `source: "template_push"` to history entries
- Clear `driftDetectedAt` on successful push (drift resolved by template)
- Log a warning when overwriting a drifted description

### Phase 4: Revert Bug Fix

**Bug:** `revertDescription` delinks the container, then fires `youtube/videos.update` Inngest event. But `updateVideoDescriptions` skips videos without containers, so the description never actually gets pushed to YouTube.

**File:** `nextjs/src/lib/services/videos.ts`

- Replace the Inngest event with a direct call to `updateVideoDescription()` from `youtube.ts`
- Create a history entry with `source: "revert"`
- Clear `driftDetectedAt`
- Remove the Inngest `send()` call

**File:** `nextjs/src/server/api/routers/dashboard/youtube.ts` (the `rollback` mutation)

- Same fix: replace Inngest event with direct YouTube push

### Phase 5: MCP/Surface Layer

**File:** `nextjs/src/lib/services/videos.ts`

- Re-include `currentDescription` in `getVideo` and `listVideos` responses (revert the exclusion from earlier) — agents need both the stored and live YouTube description to see drift
- `driftDetectedAt` is automatically included since it's on the table
- Add `checkDrift` service function: compares stored vs live YouTube description on demand (1 quota unit)
- Add `hasDrift` filter option to `listVideos`

**File:** `nextjs/src/lib/mcp/tools/videos.ts`

- Register new `check_drift` tool (READ annotation)
- Add `hasDrift` boolean filter to `list_videos`
- Update `list_videos` description to mention `driftDetectedAt`

### What NOT to Change

- `fetchChannelVideos` — already fetches descriptions, no modification needed
- `scheduledSync` — just triggers events, drift detection happens inside `syncChannelVideos`
- `categoryId: '22'` bug in `updateVideoDescription` — separate concern, different task
- Dashboard tRPC `videos.list` — already uses `getTableColumns`, new columns auto-included
- `db/relations.ts` — no new tables, only new columns

## Critical Files

- `nextjs/src/db/schema.ts`
- `nextjs/src/inngest/youtube/syncChannelVideos.ts`
- `nextjs/src/inngest/youtube/updateVideoDescriptions.ts`
- `nextjs/src/lib/services/videos.ts`
- `nextjs/src/lib/mcp/tools/videos.ts`
- `nextjs/src/server/api/routers/dashboard/youtube.ts`

## Acceptance Criteria

- [ ] Sync detects when YouTube description differs from `currentDescription` and archives the manual edit
- [ ] `descriptionHistory` entries have a `source` column distinguishing sync, template push, manual edit, and revert
- [ ] `driftDetectedAt` is set on drift detection and cleared on template push or revert
- [ ] `revert_description` actually pushes the historical description to YouTube (not just DB)
- [ ] `check_drift` MCP tool compares stored vs live YouTube description on demand
- [ ] `list_videos` supports `hasDrift` filter
- [ ] Zero additional YouTube API quota used during sync (descriptions already fetched)
- [ ] Existing videos with null `currentDescription` are skipped (no false positives)
- [ ] Vercel deploy reaches READY
