# Description Drift Detection

## Context

When users edit video descriptions directly in YouTube Studio, VidTempla doesn't detect the change. Three distinct bugs compound the problem:

1. **`syncChannelVideos.ts`** (the scheduled sync) fetches fresh descriptions from YouTube but throws them away — the existing-video branch only updates `title` and `publishedAt`, leaving `currentDescription` frozen at whatever VidTempla last pushed.

2. **`listVideos()` in `services/videos.ts:81-104`** has a lazy YouTube sync for owned channels that runs on every list call. Its `onConflictDoUpdate` only sets `title`/`publishedAt`/`updatedAt` on conflict — same staleness bug as scheduled sync, but fires every time anyone opens the Videos tab or an agent calls `list_videos`. It also explicitly strips `currentDescription` from the response shape via `getTableColumns` destructuring (`videos.ts:176`).

3. **Because `currentDescription` is stale**, the next template push in `updateVideoDescriptions.ts` sees `newDescription !== video.currentDescription` and silently stomps the user's manual edit on YouTube. No warning, no history entry, no undo.

4. **Separately**, both the service-layer `revertDescription` and its verbatim copy in `dashboard/youtube.ts:638-711` (the tRPC `rollback` mutation) delink the container *before* firing `youtube-update-video-descriptions`. That task skips any video without a container (`updateVideoDescriptions.ts:121`), so revert updates the DB but never touches YouTube. The user thinks they reverted — they didn't. Same bug, duplicated in two places.

This task adds drift detection to both sync paths, archives manual edits, surfaces drift to the UI and to agents via MCP + REST, fixes the revert bug in both copies, and finishes the router→service migration for the affected mutations. It also introduces a service-layer hard gate so push-triggering mutations refuse to overwrite drifted descriptions without an explicit `force` override.

## Sync frequency (context)

Sync fires on several triggers — relevant because drift detection now lives on two of them:

- **Scheduled cron**: `scheduledSync.ts` runs every 6 hours (`0 */6 * * *`) across all channels
- **Lazy sync on list**: `services/videos.ts:listVideos()` syncs owned-channel videos inline on every dashboard Videos tab load and every `list_videos` MCP call
- **OAuth connect/reconnect**: `pages/api/auth/youtube/callback.ts`
- **Manual sync button**: `server/api/routers/dashboard/youtube.ts:83`
- **Lazy sync on analytics fetch**: `lib/services/analytics.ts:220`

Worst case without any dashboard activity: drift sits undetected for up to 6 hours. With even one Videos tab load per day, drift is detected within seconds. Both paths write to the same `descriptionHistory` table and flip the same `driftDetectedAt` flag, so they must be idempotent against concurrent execution (see "Concurrency" decision below).

No additional YouTube API quota is consumed for drift detection in either path: `fetchChannelVideos` already pulls descriptions for every video in the uploads playlist. We just stop discarding them.

## Design decisions

### Do NOT auto-delink the container on drift detection

Auto-delinking on every drift is the same class of silent destructive action this task is trying to prevent. A user edits one line on YouTube (typo, affiliate swap, rushed note) and comes back to find their entire container assignment + all `videoVariables` wiped.

**Policy**: drift detection flips a flag. Delinking remains an explicit user action via `resolveDrift` with `strategy: "keep_youtube_edit"` or the dashboard's History drawer drift banner. Future extension: per-container `onDrift` policy setting — not in this task.

### Delinking elsewhere DOES clear drift (invariant)

Any operation that sets `containerId = null` on a video also sets `driftDetectedAt = null` in the same write. The drift concept only applies to videos under template management — once a video is unlinked, drift is meaningless. This invariant must be enforced at every write site that nulls `containerId`:

- `assignToContainer(videoId, null)` in service layer (and its tRPC wrapper)
- `resolveDrift` with `strategy: "keep_youtube_edit"`
- `revertDescription` (already delinks)
- Any future "remove from container" action

The inverse also holds: drift detection on a video with `containerId = null` is a no-op in sync logic. If sync sees a live-vs-stored difference on an unlinked video, it silently updates `currentDescription` but does NOT write a history row or flip `driftDetectedAt`. Template management is the precondition for drift being meaningful.

### `driftDetectedAt` is a nullable timestamp, not a boolean

- Null = no drift; not-null = drifted. Boolean semantics for free via `IS NOT NULL`.
- Timestamp preserves "when" — agents triaging a list want to distinguish 3-minute-old drifts from 11-day-old ones.
- Sortable for a "recently drifted" feed without joins.
- Cleared on template push, revert, and any action that delinks the container.

### No separate `lastDriftDescription` column

`descriptionHistory` already contains every version. The pre-drift state is the most recent row where `source = "manual_youtube_edit"` (or the row before the current one for the UI's diff view).

### Source column is text, not pgEnum

`source: text("source")` on `descriptionHistory` plus a TypeScript union `HistorySource = "initial_sync" | "template_push" | "manual_youtube_edit" | "revert"`. Consistent with how `planTier`, `syncStatus`, `tokenStatus` are already modeled. No DB check constraint — rely on app-layer type safety. Adding new source values later is zero migration work.

Existing rows keep `source = null` (predate the feature). The UI renders null-source rows with **no badge at all** — absence is the signal. No backfill.

### Hard gate with `force` override, not soft warning

Push-triggering service functions (`updateVideoVariables`, `reorderContainerTemplates`, `updateTemplate`, etc.) refuse to trigger a YouTube push on a drifted video unless the caller passes `force: true`. On drift, they return:

```ts
{
  code: "VIDEO_HAS_DRIFT",
  message: "Video was edited on YouTube on {driftDetectedAt formatted}",
  suggestion: "Review the edit with get_description_history, then retry with force: true to overwrite OR call resolve_drift with strategy 'keep_youtube_edit' to preserve it",
  status: 409,
  meta: {
    driftedVideoIds: [...],          // one entry for single-video ops, N for bulk
    driftDetectedAt: "2026-04-12T...",
    latestManualEditHistoryId: "uuid", // for quick diff lookup
  }
}
```

**Why hard-gate at the service layer**:

- Single place to enforce the check — the 9 existing `tasks.trigger("youtube-update-video-descriptions")` call sites all flow through service functions (after the router→service refactor in Phase 4)
- MCP, REST, and dashboard UI all go through the same services, so they all get the gate for free
- Dashboard UI catches `VIDEO_HAS_DRIFT` and shows a confirmation dialog
- Agents get a machine-readable error with a suggested next step, not a silent successful overwrite
- The `updateVideoDescriptions` Trigger.dev task still logs a warning if it sees `driftDetectedAt != null` on a video it's about to push — defense-in-depth, but the real gate is upstream

### Dedup strategy: skip insert if latest history row already matches

Because `listVideos` lazy-sync runs on every dashboard/MCP list call, drift history could spam if we naively insert on every detection. Before inserting a `manual_youtube_edit` row, query the most recent history row for that video (SELECT with `ORDER BY versionNumber DESC LIMIT 1`). If its `description` equals the live YouTube text, skip the insert — just update `currentDescription` and `driftDetectedAt`. One real edit → one row, regardless of how many times sync runs.

Approximate cost: +1 SELECT per drifted video per sync. Drift is rare, so this is fine.

### Concurrency: per-video `SELECT ... FOR UPDATE` transaction

Two sync paths can run concurrently on the same channel (scheduled cron + dashboard tab open on the same channel at the same time). Without locking, both could SELECT stale state, both compare, both insert duplicate history rows before either write commits. Dedup alone doesn't close this — the race is between the SELECT and the INSERT.

**Per-video transaction**: for each drifted video, open a transaction, `SELECT ... FOR UPDATE` on the `youtubeVideos` row, re-read the latest history row inside the transaction, compare, conditionally insert, update `currentDescription` + `driftDetectedAt`, commit. Lock is held only for the duration of one video's drift-write block (a few ms).

- Drift is rare → contention is near-zero
- Transaction scope is per-video, not per-sync-run → no Trigger.dev timeout interaction
- Serializes the exact operation that needs to be atomic: "decide whether to write history, then write history + flag together"

Apply this pattern in BOTH `syncChannelVideos.ts` and the new `listVideos` lazy-sync drift branch.

### Baseline sync on first post-deploy run per channel

First sync after deploy would otherwise surface thousands of false "drift" events — every video whose description changed on YouTube since the last template push (before the feature existed) would be flagged. Solution: a silent baseline pass.

**Implementation**:

- New column `driftBaselinedAt` on `youtubeChannels` (nullable `timestamp with timezone`), default null.
- At the top of the drift-detection branch (in both `syncChannelVideos` and `listVideos` lazy-sync), check the channel's `driftBaselinedAt`.
- If null: this is the baseline pass. For every existing video, silently update `currentDescription` to match YouTube, do NOT insert history rows, do NOT flip `driftDetectedAt`. At the end of the channel sync, set `driftBaselinedAt = now()` in the same transaction as the final write.
- If not null: run drift detection normally.

Lazy — no one-shot deploy task, no manual trigger. First sync that happens to run post-deploy does the baselining for that channel. Channels synced again later just see `driftBaselinedAt != null` and proceed normally. Zero operator involvement.

Edge case: the baseline check and set must be atomic. If two sync paths race to baseline the same channel, both would see `driftBaselinedAt = null` at the start. Mitigation: SELECT FOR UPDATE on the `youtubeChannels` row at the start of sync, or compare-and-set on `driftBaselinedAt` when writing (`UPDATE ... SET driftBaselinedAt = now() WHERE id = ? AND driftBaselinedAt IS NULL`). The second path becomes a no-op at write time.

### `resolve_drift` with `reapply_template` preserves variables

Unlike `revertDescription` (which clears all variables on revert because it's semantically abandoning the template lineage), `resolve_drift` with `strategy: "reapply_template"` preserves variables. The user deliberately chose to keep the template active; the reapply rebuilds the description with current variables and pushes it. Repeatable, safe, non-destructive.

### `resolve_drift` with `reapply_template` on an unassigned video is an error

If `videoId.containerId` is null, there's no template to reapply. Return:

```ts
{
  code: "CANNOT_REAPPLY_NO_CONTAINER",
  message: "Video has no container assigned, cannot re-apply template",
  suggestion: "Assign the video to a container first with assign_video, or use strategy 'keep_youtube_edit' to accept the current description",
  status: 400,
}
```

Force the caller to make an explicit choice rather than silently falling back.

### Router → service layer refactor (finish the migration)

The earlier `extract-service-layer-and-description-history` task migrated some mutations to the service layer but left `dashboard/youtube.ts:638-711` (`rollback`) as a verbatim copy of `revertDescription`. This task finishes that specific migration:

- Replace the router's `rollback` body with a single call to `revertDescription()` from the service.
- Verify no other router-layer duplication exists for the mutations this task touches. The router's `updateToYouTube` (line 713) just wraps `tasks.trigger` — after the hard gate is in place, it needs to route through a service function too (new `pushVideoDescriptions(videoIds, { force })` service function), same for the other direct `tasks.trigger` call sites in the router (lines 167, 289, 617). Each gets moved behind a thin service wrapper that owns the drift check.

Broader router-service cleanup across unrelated mutations is out of scope — only the push-triggering ones that this task's hard gate affects.

### Owned vs unowned response shape: normalize field names

Today's split:

- **Owned** (from DB): `{ ...youtubeVideos columns, channel, container }` with `currentDescription` currently stripped
- **Unowned** (live from YouTube): `{ videoId, title, description, publishedAt }`

**Normalize**: both paths return the same field names. Unowned videos get `currentDescription` (mapped from live YouTube), `driftDetectedAt: null` (no stored state to drift from), `containerId: null`, `container: null`. The existing `source: "db" | "youtube"` discriminator in `listVideos`'s wrapper already signals provenance; MCP/REST agents can branch on that if they need to.

`hasDrift` filter only applies to owned channels — the unowned path short-circuits before the filter is evaluated (nothing to filter on). Document this in the MCP tool description.

### Bulk resolve is out of scope for v1

`resolve_drift` takes a single `videoId`. Agents loop. If bulk resolution becomes a real pain point later, add `bulk_resolve_drift` as a follow-up task. YAGNI.

## Plan

### Phase 1: Schema changes

**File:** `nextjs/src/db/schema.ts`

1. Add `source` column to `descriptionHistory` as `text("source")`, nullable, default null:
   - TypeScript union: `export type HistorySource = "initial_sync" | "template_push" | "manual_youtube_edit" | "revert"`
   - Existing rows stay null (predates feature). No backfill.

2. Add `driftDetectedAt` to `youtubeVideos` (nullable `timestamp with timezone`):
   - Set when drift detected
   - Cleared on template push, revert, delink, or explicit `resolve_drift`

3. Add `driftBaselinedAt` to `youtubeChannels` (nullable `timestamp with timezone`):
   - Null on deploy; set on first post-deploy sync per channel
   - Marks the boundary between "baseline drift silently" and "track drift normally"

4. Run `npx drizzle-kit generate` to create migration SQL in `nextjs/drizzle/`. Review the generated file before committing.

### Phase 2: Sync drift detection (scheduled + lazy)

Both sync paths need identical drift logic. Extract it into a shared helper in a new file `nextjs/src/lib/services/drift.ts`:

```ts
export async function detectAndRecordDrift(
  videoIdInternal: string,
  liveDescription: string,
  userId: string,
  tx: DbTransaction, // drizzle tx object from an outer transaction
): Promise<{ drifted: boolean; skippedDedup: boolean }>
```

Behavior inside `detectAndRecordDrift`:

1. `SELECT ... FOR UPDATE` the `youtubeVideos` row by internal id
2. If `currentDescription` is null → skip (legacy row, pre-feature)
3. If `containerId` is null → silently update `currentDescription = live`, do NOT write history, do NOT flip drift flag (drift is only meaningful for template-managed videos)
4. If `live === currentDescription` → no drift, return `{ drifted: false }`
5. Drift detected. Fetch the most recent `descriptionHistory` row for this video (`ORDER BY versionNumber DESC LIMIT 1`) inside the transaction
6. If that row's `description === live` AND `source === "manual_youtube_edit"` → dedup hit. Just update `currentDescription = live` and `driftDetectedAt = now()` (refresh the timestamp), skip the insert, return `{ drifted: true, skippedDedup: true }`
7. Otherwise: compute `versionNumber = max(versionNumber) + 1` for this video (cheap inline query, drift is rare), insert a new `descriptionHistory` row with `source: "manual_youtube_edit"`, description = live, createdBy = userId
8. Update `youtubeVideos`: `currentDescription = live`, `driftDetectedAt = now()`
9. Commit transaction. Return `{ drifted: true, skippedDedup: false }`

**Baseline handling**: the caller (`syncChannelVideos` or `listVideos` lazy-sync) checks the parent channel's `driftBaselinedAt`. If null, the caller skips `detectAndRecordDrift` entirely and instead does a plain `UPDATE youtubeVideos SET currentDescription = live WHERE id = ?`. After processing all videos in the channel, the caller sets `driftBaselinedAt = now()` using a compare-and-set guard (`WHERE driftBaselinedAt IS NULL`) so concurrent baseline passes don't double-baseline.

#### `syncChannelVideos.ts` changes

Current problem (`syncChannelVideos.ts:181-228`): existing-video query selects only `videoId`; the existing-video branch only updates `title` and `publishedAt`.

Changes:

- At the top of the sync, read the channel's `driftBaselinedAt`. Thread a `isBaseline = driftBaselinedAt === null` boolean through the video loop.
- Expand `existingVideos` query to select `id`, `videoId`, `currentDescription`, `containerId` — build a `Map<videoId, { id, currentDescription, containerId }>`.
- In the new-video branch (line 194): insert with `source: "initial_sync"` in the history row. Unchanged otherwise.
- In the existing-video branch (line 215): after updating `title` and `publishedAt`, call:
  - If `isBaseline`: plain `UPDATE youtubeVideos SET currentDescription = ytVideo.snippet.description WHERE id = ?`
  - Else: `detectAndRecordDrift(existing.id, ytVideo.snippet.description, userId, tx)`
- After the loop, if `isBaseline`, set `driftBaselinedAt = now()` on the channel row (compare-and-set guard).

#### `listVideos()` lazy-sync changes (`services/videos.ts:76-108`)

Current problem: `onConflictDoUpdate` sets only `title`/`publishedAt`/`updatedAt`; the fresh `v.snippet.description` is fetched but discarded on conflict.

Changes:

- Replace the single `Promise.all(page.videos.map(...))` with a sequential loop (or chunked parallelism) that can transactionally handle drift per video.
- For each live video:
  - If video doesn't exist in DB: insert with description and history row (`source: "initial_sync"`). Match `syncChannelVideos`'s new-video branch.
  - If video exists and channel is baselining: plain update of `title`, `publishedAt`, `updatedAt`, `currentDescription`.
  - If video exists and channel is baselined: update `title`/`publishedAt`/`updatedAt`, then call `detectAndRecordDrift(existing.id, v.snippet.description, userId, tx)`.
- At the start of `listVideos`'s owned-channel branch, read `driftBaselinedAt` for the channel; at the end, if baselining was active, set it with the compare-and-set guard.
- **Error tolerance**: the existing code has `try/catch` around the whole sync block and silently falls through to DB query on failure (comment: "YouTube sync failed — fall through to DB query with stale data"). Preserve that tolerance — a failed drift detection should not break `listVideos`.

**Response shape** (same file, line 176): remove the `const { currentDescription: _, ...videoColumns } = getTableColumns(youtubeVideos);` destructuring. Include `currentDescription` and `driftDetectedAt` in the SELECT. This is what makes drift visible to all callers.

**Normalize unowned shape** (`videos.ts:119-146`): unowned videos now return `{ videoId, title, currentDescription: v.snippet.description, publishedAt, driftDetectedAt: null, containerId: null, container: null, channel: {...} }` to match the owned shape. Consumers use the outer `source: "db" | "youtube"` discriminator to tell them apart.

### Phase 3: Template push hard gate

**File:** `nextjs/src/trigger/updateVideoDescriptions.ts`

Changes at the task layer (defense-in-depth):

1. Add `source: "template_push"` to the history insert at line 223
2. After successful YouTube push, clear `driftDetectedAt` in the DB update at line 219
3. Before pushing, if video has `driftDetectedAt != null`, log `logger.warn("Overwriting drifted description via template push", { videoId, driftDetectedAt })`. Do NOT block the push at the task layer — the service-layer gate upstream is the real check.

**File:** `nextjs/src/lib/services/drift.ts` (new)

Add a shared helper:

```ts
export async function assertNoDrift(
  videoIds: string[],
  opts: { force?: boolean } = {},
): Promise<{ blocked: DriftBlockInfo } | null>
```

Returns `null` if no drift found OR `force: true` passed. Returns structured `VIDEO_HAS_DRIFT` error info otherwise (single-video and bulk callers handle the same shape — single is just `driftedVideoIds.length === 1`).

Wire `assertNoDrift` into every push-triggering service function:

- `updateVideoVariables` (`services/videos.ts:502` call site) — single-video, checks drift on the target video
- `revertDescription` (same file, line 609) — no drift check needed (revert explicitly clobbers). Also: this function's `tasks.trigger` call is being replaced with a direct YouTube push in Phase 4.
- `reorderContainerTemplates` (`services/containers.ts:153` call site) — bulk, checks all videos in the container
- `updateTemplate` (`services/templates.ts:141` call site) — bulk, checks all videos in all containers using the template
- Any direct router-layer `tasks.trigger` sites (`dashboard/youtube.ts:167`, `:289`, `:617`, `:724`): refactored in Phase 4 to route through new service wrappers like `pushVideoDescriptions(videoIds, { force })` that own the drift check

**Dashboard / MCP / REST caller pattern**:

- Dashboard UI mutations pass `force: false` by default. On `VIDEO_HAS_DRIFT` error, the UI catches it and shows a confirmation dialog. If user confirms "Overwrite", UI retries the mutation with `force: true`.
- MCP tools expose `force` as an optional Zod parameter (default `false`). Agents see `VIDEO_HAS_DRIFT` in the error and can retry with `force: true` or call `resolve_drift` instead.
- REST API exposes `force` as a JSON body field. Same error shape, same retry pattern.

### Phase 4: Revert bug fix + router→service refactor

**Bug**: Both `revertDescription` (service) and the `rollback` mutation (router, `dashboard/youtube.ts:638-711`) delink the container, then fire `youtube-update-video-descriptions`. That task skips videos without containers — YouTube never updated.

**Fix in the service** (`nextjs/src/lib/services/videos.ts` — `revertDescription`):

- Extract a new shared helper `getChannelAccessToken(channelId)` in `lib/clients/youtube.ts` that encapsulates the token-refresh-and-return logic currently duplicated in `updateVideoDescriptions.ts:35-97`. Both the task and the new direct-push sites use it.
- Replace the `tasks.trigger("youtube-update-video-descriptions", ...)` call in `revertDescription` with a direct call to `updateVideoDescription()` from `lib/clients/youtube.ts`, passing the historical description string directly. No need to rebuild from templates — we already have the exact text.
- Insert a `descriptionHistory` row with `source: "revert"` and the historical description
- Clear `driftDetectedAt` (revert explicitly resolves drift)
- Delink container + clear variables + set `currentDescription` as the function already does (the existing logic there is correct; only the YouTube-push path was broken)

**Fix the router copy** (`nextjs/src/server/api/routers/dashboard/youtube.ts:638-711`):

- Delete the entire inline body of the `rollback` mutation
- Replace with: `const result = await revertDescription(input.videoId, input.historyId, ctx.user.id, ctx.organizationId); if ("error" in result) throw new TRPCError(...); return result.data;`
- The router becomes a thin wrapper. Service is the source of truth. Error mapping from service result shape to TRPCError follows the existing pattern used by other router mutations that delegate to services.

**REST route** (`nextjs/src/app/api/v1/videos/[id]/history/[historyId]/revert/route.ts`):

- Verify it already routes through `revertDescription` (it should — this file exists today). If it duplicates logic, refactor it the same way.

**Other push sites in the router that need service wrappers** (lines 167, 289, 617, 701, 724):

- Each of these is a direct `tasks.trigger("youtube-update-video-descriptions")` call in a router mutation.
- Extract a new service function `pushVideoDescriptions(videoIds, userId, { force?: boolean }, organizationId?)` in `services/videos.ts`. It runs `assertNoDrift`, then triggers the task.
- Replace each router-layer `tasks.trigger` with a call to `pushVideoDescriptions`. Router mutations become thin wrappers that pass through `force` from their input.

### Phase 5: Service layer + MCP surface

**File:** `nextjs/src/lib/services/videos.ts`

New functions:

- `getVideo(videoId, userId, organizationId)` — returns a single video with `channel`, `container`, `currentDescription`, `driftDetectedAt`. Required by the new `videos.get` tRPC endpoint (below) and the REST `GET /api/v1/videos/:id`. Replaces the "fetch whole list, find in memory" anti-pattern currently used by `HistoryDrawer`.
- `checkDrift(videoId, userId, organizationId)` — fetches live YouTube description via the API (1 quota unit), compares to stored `currentDescription`, returns `{ hasDrift: boolean, stored: string, live: string, driftDetectedAt: Date | null }`. Does NOT mutate the DB — read-only "check now" for agents that don't want to wait for sync.
- `resolveDrift(videoId, userId, organizationId, input: { strategy, historyId?, force? })` — three strategies:
  - `"keep_youtube_edit"`: delink container (`containerId = null`), clear variables, clear `driftDetectedAt`, leave `currentDescription` as-is (already matches live). No YouTube push.
  - `"reapply_template"`: if `containerId` is null, return `CANNOT_REAPPLY_NO_CONTAINER`. Otherwise, rebuild description from the container's templates + **current** variables (do NOT clear variables), push to YouTube via direct `updateVideoDescription()` call, insert `source: "template_push"` history row, clear `driftDetectedAt`.
  - `"revert_to_version"` + `historyId`: delegate to `revertDescription(videoId, historyId, ...)`.

**Modifications**:

- `listVideos`: include `currentDescription` and `driftDetectedAt`; add `hasDrift?: boolean` filter (`WHERE driftDetectedAt IS NOT NULL`). Owned-only — document in MCP tool description.
- `updateVideoVariables`: accept `force?: boolean`. Before writing variables, call `assertNoDrift([videoId], { force })`. If it returns an error, return that error up the stack.
- `assignToContainer`: when `containerId` is being set to null, also set `driftDetectedAt = null` in the same update (delink invariant).

**File:** `nextjs/src/server/api/routers/dashboard/youtube.ts`

- Add `get: orgProcedure.input(z.object({ videoId: z.string() })).query(({ ctx, input }) => getVideo(input.videoId, ctx.user.id, ctx.organizationId))`
- Add `resolveDrift: orgProcedure.input(...).mutation(...)` delegating to the service
- Add `checkDrift: orgProcedure.input(...).query(...)` delegating to the service
- `updateVariables` mutation: add optional `force` to input, pass through to service
- Refactor direct `tasks.trigger` sites (167, 289, 617, 724) to call `pushVideoDescriptions` service wrapper
- Refactor `rollback` (638-711) to call `revertDescription` service

**File:** `nextjs/src/lib/mcp/tools/videos.ts`

- Register `check_drift` tool (READ annotation, document 1 YouTube quota unit)
- Register `resolve_drift` tool (WRITE annotation), params: `id`, `strategy`, optional `historyId`
- Register `get_video` tool (READ) — wrap the new `getVideo` service. Returns single video with `currentDescription`, `driftDetectedAt`, etc.
- Update `list_videos` schema: add `hasDrift` boolean filter. Document that `hasDrift` is ignored for unowned channels.
- Update `list_videos` and `get_video` descriptions to explain `currentDescription` semantics and `driftDetectedAt`.
- Add `force` parameter to `update_video_variables` tool. Document the `VIDEO_HAS_DRIFT` error behavior in the tool description.

### Phase 6: Dashboard UI

#### Videos table (`nextjs/src/components/youtube/VideosTab.tsx`)

- **Row-level badge**: in the "Video" cell next to the title and play icon, render an amber `⚠ Edited on YouTube` badge when `video.driftDetectedAt != null`. Use `AlertTriangle` from lucide-react + shadcn `Badge`. Tooltip: `"Description was edited outside VidTempla on {driftDetectedAt formatted}. Click History to review."`
- **Row tint**: subtle amber background (`bg-yellow-500/5`) on drifted rows
- **Drift filter**: add a fourth filter Select next to Channel/Container/Search: "Drift" with options `All` / `Drifted only` / `Not drifted`. Maps to the `hasDrift` param on the tRPC list query.
- **Empty state**: when "Drifted only" is selected and there are none, show `"No drift detected. All videos match what VidTempla last pushed."`

#### History drawer (`nextjs/src/components/youtube/HistoryDrawer.tsx`)

**Refactor data fetching**: replace `api.dashboard.youtube.videos.list.useQuery({}, { enabled: open })` + in-memory `find` with `api.dashboard.youtube.videos.get.useQuery({ videoId }, { enabled: open })`. Single-video query, no wasted rows.

**Drift banner**: at the top of the drawer, above the version list, render when `currentVideo?.driftDetectedAt != null`:

```
⚠ Drift detected {relative time}
Description was edited on YouTube Studio outside of VidTempla.
[Resolve drift ▼]
```

"Resolve drift" opens a menu with three actions:

- **"Keep YouTube edit"** → calls `resolveDrift` mutation with `keep_youtube_edit`. Confirmation dialog listing what will be lost (same warning style as existing rollback dialog): container delinked, N variable(s) cleared.
- **"Re-apply template"** → calls `resolveDrift` with `reapply_template`. Confirmation dialog: `"This will overwrite the edit made on YouTube Studio with the current template output. The manual edit will still be saved in version history."` If the video has no container, the button is disabled with a tooltip explaining `"Assign the video to a container first."`
- **"Revert to a previous version"** → closes the banner dropdown; user picks a version from the list and uses the existing rollback flow.

**Source badges on history entries**: next to the version number on each history card, render a shadcn `Badge` keyed off `source`:

- `initial_sync` → gray, text `"Sync"`
- `template_push` → blue, text `"Template"`
- `manual_youtube_edit` → amber, text `"Edited on YouTube"`
- `revert` → purple, text `"Revert"`
- `null` → **no badge at all** (legacy pre-feature rows)

Manual-edit entries also get an amber left border on the card (visual reinforcement).

#### EditVariablesSheet (`nextjs/src/components/youtube/EditVariablesSheet.tsx`)

- On save, the existing `updateVariables` mutation now accepts `force`. Dashboard calls it with `force: false` first.
- If the response contains `VIDEO_HAS_DRIFT` error code, catch and open a new `DriftConfirmDialog` component with:
  - Header: `⚠ This video was edited on YouTube on {date}`
  - Collapsed preview: first 3 lines of the drifted YouTube text with a "View full" expand toggle (expand renders the full text in a read-only `Textarea`)
  - Three actions:
    - `Cancel` — dismiss dialog, sheet stays open, no changes saved
    - `Save and overwrite edit` — retries `updateVariables` with `force: true`. Success closes both dialog and sheet.
    - `Discard my variable changes, keep YouTube edit` — calls `resolveDrift` with `strategy: "keep_youtube_edit"`, discards pending sheet edits, closes both. Explicit opt-out for the user who realizes they'd rather honor the edit.
- The diff preview is fetched lazily via `getDescriptionHistory` filtered to the latest `manual_youtube_edit` entry (ID is in the error's `meta.latestManualEditHistoryId`).

#### Container template reorder (wherever templates are reordered on a container)

- Save mutation now accepts `force`. Dashboard calls it with `force: false` first.
- On `VIDEO_HAS_DRIFT` error, open a bulk confirmation dialog:
  ```
  ⚠ N of M videos in this container have been edited on YouTube Studio.
  Saving will overwrite those edits. They'll be preserved in version history.

  [Cancel]  [Review drifted videos]  [Overwrite all]
  ```
  - The error's `meta.driftedVideoIds` provides the count N
  - "Review drifted videos" deep-links to the Videos tab with `hasDrift=true` + `containerId={current}` pre-applied as URL search params
  - "Overwrite all" retries the save with `force: true`

Do NOT list every drifted video inline in the dialog — the count + deep link scales better.

#### No changes

- No channel-level drift counter in v1 (per-channel aggregate on channel cards is a follow-up)
- No drift surfacing on unowned videos (by design — drift only applies to template-managed videos)

### Phase 7: REST API

**New endpoints** under `nextjs/src/app/api/v1/videos/`:

- `GET /api/v1/videos/:id` — already exists; ensure it now returns `currentDescription` and `driftDetectedAt` after the service layer changes
- `POST /api/v1/videos/:id/check-drift` — wraps `checkDrift` service. Response: `{ data: { hasDrift, stored, live, driftDetectedAt } }`
- `POST /api/v1/videos/:id/resolve-drift` — wraps `resolveDrift` service. Body: `{ strategy, historyId?, force? }`. Same error behavior as MCP.
- `GET /api/v1/videos` list endpoint — already exists; add `hasDrift` query param; add `force` body field to any push-triggering endpoints

**Existing `/api/v1/videos/:id/history/:historyId/revert/route.ts`**: verify it goes through `revertDescription` service (it should — just double-check it isn't a second duplicated copy of the rollback logic).

**Existing `/api/v1/videos/:id/variables/route.ts`** and any other push endpoints: add `force` body field, pass through to the service layer.

Follow the existing `withApiKey` + `apiSuccess` / `apiError` pattern. See `nextjs/src/app/api/v1/CLAUDE.md`.

## What NOT to change

- `fetchChannelVideos` in `lib/clients/youtube.ts` — already fetches descriptions
- `scheduledSync.ts` — just fans out per-channel sync tasks; drift logic lives inside `syncChannelVideos`
- `categoryId: '22'` bug in `updateVideoDescription` — separate concern, spin out as its own task
- `db/relations.ts` — no new tables, only new columns
- Per-container `onDrift` policy setting — explicit future extension, out of scope
- Bulk `resolve_drift` — out of scope for v1
- Channel-level drift aggregate UI — out of scope for v1
- Backfill of `source` on existing history rows — explicitly not doing this (null renders as no badge)
- Broader router→service migration for unrelated mutations — only the push-triggering ones this task's hard gate affects
- Any formal verification plan (Playwright tests, unit tests, feature flag rollout) — explicitly out of scope

## Critical files

### Schema
- `nextjs/src/db/schema.ts` — `source` column on `descriptionHistory`, `driftDetectedAt` on `youtubeVideos`, `driftBaselinedAt` on `youtubeChannels`

### Sync / drift detection
- `nextjs/src/lib/services/drift.ts` **(new)** — `detectAndRecordDrift`, `assertNoDrift`, shared types
- `nextjs/src/trigger/syncChannelVideos.ts` — existing-video branch, baseline check, drift helper call
- `nextjs/src/lib/services/videos.ts` — `listVideos` lazy-sync drift logic, response shape normalization, new `getVideo`, `checkDrift`, `resolveDrift`, `pushVideoDescriptions`, fixed `revertDescription`
- `nextjs/src/trigger/updateVideoDescriptions.ts` — `source` on history, clear `driftDetectedAt`, warning log
- `nextjs/src/lib/clients/youtube.ts` — extract shared `getChannelAccessToken` helper

### Routing
- `nextjs/src/server/api/routers/dashboard/youtube.ts` — refactor `rollback`, refactor direct `tasks.trigger` sites to service wrappers, add `get`, `resolveDrift`, `checkDrift` procedures, add `force` to `updateVariables`
- `nextjs/src/lib/services/templates.ts` — `assertNoDrift` on push trigger
- `nextjs/src/lib/services/containers.ts` — `assertNoDrift` on push trigger

### MCP
- `nextjs/src/lib/mcp/tools/videos.ts` — new `get_video`, `check_drift`, `resolve_drift` tools; `hasDrift` filter + `force` param updates

### REST
- `nextjs/src/app/api/v1/videos/[id]/check-drift/route.ts` **(new)**
- `nextjs/src/app/api/v1/videos/[id]/resolve-drift/route.ts` **(new)**
- `nextjs/src/app/api/v1/videos/[id]/route.ts` — ensure `currentDescription` + `driftDetectedAt` included
- `nextjs/src/app/api/v1/videos/route.ts` — add `hasDrift` query param
- `nextjs/src/app/api/v1/videos/[id]/variables/route.ts` — add `force` body field
- `nextjs/src/app/api/v1/videos/[id]/history/[historyId]/revert/route.ts` — verify delegates to service

### Dashboard UI
- `nextjs/src/components/youtube/VideosTab.tsx` — badge, row tint, Drift filter
- `nextjs/src/components/youtube/HistoryDrawer.tsx` — drift banner, source badges, resolve actions, refactor to `videos.get`
- `nextjs/src/components/youtube/EditVariablesSheet.tsx` — pre-push drift confirmation with diff preview
- `nextjs/src/components/youtube/DriftConfirmDialog.tsx` **(new)** — reusable dialog for both single-video and bulk flows
- Wherever container template reorder lives — bulk drift confirmation dialog hookup

## Acceptance criteria

### Schema
- [ ] `description_history.source` column exists (text, nullable); migration SQL committed
- [ ] `youtube_videos.drift_detected_at` column exists (timestamptz, nullable)
- [ ] `youtube_channels.drift_baselined_at` column exists (timestamptz, nullable)
- [ ] TypeScript `HistorySource` union exported and used at every history insert call site

### Sync detection
- [ ] `syncChannelVideos` detects drift on existing videos and archives via `detectAndRecordDrift`
- [ ] `listVideos` lazy-sync applies the same drift logic with the same dedup + transaction guarantees
- [ ] `detectAndRecordDrift` is wrapped in a per-video transaction with `SELECT ... FOR UPDATE` on the `youtube_videos` row
- [ ] Dedup: if the latest history row already has `description === live` and `source === "manual_youtube_edit"`, no new row is inserted (timestamp refresh only)
- [ ] Videos with null `currentDescription` are skipped (no false positives from legacy rows)
- [ ] Videos with null `containerId` silently update `currentDescription` without writing history or flipping the drift flag
- [ ] New-video history entries have `source: "initial_sync"`

### Baseline rollout
- [ ] On first sync after deploy, each channel's `drift_baselined_at` is null → baseline pass runs (silent `currentDescription` updates, no history writes, no drift flags)
- [ ] Baseline pass sets `drift_baselined_at` at the end via compare-and-set guard
- [ ] Subsequent syncs see non-null `drift_baselined_at` and run drift detection normally
- [ ] No one-shot deploy task required

### Template push
- [ ] Template-push history entries have `source: "template_push"` and clear `drift_detected_at`
- [ ] Template push logs a warning when overwriting a drifted video (task-layer defense)
- [ ] Service-layer `assertNoDrift` gate rejects push-triggering mutations with `VIDEO_HAS_DRIFT` unless `force: true`
- [ ] Error response includes `driftedVideoIds`, `driftDetectedAt`, `latestManualEditHistoryId` in `meta`
- [ ] Every push-triggering call site (updateVariables, reorderContainerTemplates, updateTemplate, pushVideoDescriptions wrapper) routes through `assertNoDrift`

### Revert + router→service refactor
- [ ] `revertDescription` pushes directly to YouTube via `updateVideoDescription()`, not via the Trigger.dev task
- [ ] `revertDescription` writes a history row with `source: "revert"` and clears `drift_detected_at`
- [ ] `getChannelAccessToken` helper extracted into `lib/clients/youtube.ts` and used by both the task and direct push sites
- [ ] Dashboard router `rollback` mutation is a thin wrapper calling `revertDescription` — no duplicated logic
- [ ] Router direct `tasks.trigger` call sites (167, 289, 617, 724) all route through `pushVideoDescriptions` service wrapper
- [ ] REST revert route delegates to the same `revertDescription` service

### Delink invariant
- [ ] Every write that sets `containerId = null` also sets `drift_detected_at = null` in the same update
- [ ] Sync silently updates `currentDescription` on unassigned videos without writing drift history

### Service + MCP + REST surface
- [ ] `getVideo(videoId)` service exists; `videos.get` tRPC query exposes it; MCP `get_video` tool registered
- [ ] `checkDrift` service exists; MCP `check_drift` tool registered (READ, 1 quota); REST `POST /check-drift` route
- [ ] `resolveDrift` service supports `keep_youtube_edit`, `reapply_template`, `revert_to_version`
- [ ] `resolveDrift` with `reapply_template` preserves video variables
- [ ] `resolveDrift` with `reapply_template` on a null-container video returns `CANNOT_REAPPLY_NO_CONTAINER`
- [ ] MCP `resolve_drift` tool registered (WRITE); REST `POST /resolve-drift` route
- [ ] `list_videos` / `listVideos()` owned-channel response includes `currentDescription` and `driftDetectedAt`
- [ ] `list_videos` / `listVideos()` unowned response is normalized: same field names, `currentDescription` populated from live, `driftDetectedAt: null`, `containerId: null`, `container: null`
- [ ] `hasDrift` filter supported in tRPC, MCP, and REST list endpoints; owned-only, documented
- [ ] MCP `update_video_variables` (and equivalents) expose `force` parameter; documented `VIDEO_HAS_DRIFT` error behavior in tool description

### Dashboard UI
- [ ] Videos tab shows amber "Edited on YouTube" badge and row tint on drifted videos
- [ ] Videos tab has a Drift filter (All / Drifted only / Not drifted)
- [ ] History drawer uses new `videos.get` query (no more fetch-whole-list-and-find)
- [ ] History drawer shows a drift banner with Resolve drift menu when `driftDetectedAt` is set
- [ ] History drawer "Re-apply template" option is disabled with tooltip when video has no container
- [ ] History drawer shows source badges on every version card; null-source rows have NO badge
- [ ] `DriftConfirmDialog` component handles single-video (with diff preview) and bulk (with deep link) modes
- [ ] `EditVariablesSheet` pre-push confirmation includes diff preview and three actions
- [ ] Container template reorder shows bulk drift confirmation dialog with summary count and deep link to filtered Videos tab

### Invariants
- [ ] Container is NOT auto-delinked on drift detection
- [ ] Zero additional YouTube API quota consumed during scheduled sync for drift detection (descriptions were already fetched)
- [ ] Zero additional YouTube API quota consumed by `listVideos` lazy-sync drift detection (descriptions were already fetched)
- [ ] Vercel deploy reaches READY
