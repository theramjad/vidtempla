# Migrate from Inngest to Trigger.dev

## Context

VidTempla currently uses Inngest (v3.28.0) for background jobs — 3 functions served via a Pages API route. Trigger.dev v3 shuts down new deploys April 1, 2026 and fully sunsets July 1, 2026, so we're targeting **Trigger.dev v4** directly. ACS already runs Trigger.dev v4 (`@trigger.dev/sdk@^4.3.2`) and can be used as a reference implementation.

**Key architectural shift:** Inngest runs functions inside the Next.js process (Inngest calls our API route). Trigger.dev runs tasks in its own managed infrastructure — no API route needed. Tasks are deployed separately from the Vercel app. Environment variables needed by tasks must be set in the Trigger.dev dashboard (or synced via `syncVercelEnvVars` build extension).

## Current Inngest Setup

### Client
- **File:** `nextjs/src/lib/clients/inngest.ts`
- Creates `Inngest` client with id `"vidtempla"` and typed event schemas

### API Route
- **File:** `nextjs/src/pages/api/inngest.ts`
- `serve()` handler with `maxDuration: 720` (12 min), registers all 3 functions

### Functions
1. **`scheduledSync`** (`nextjs/src/inngest/youtube/scheduledSync.ts`)
   - Cron: `0 */6 * * *` (every 6 hours)
   - Fetches all channels, fans out `youtube/channel.sync` events

2. **`syncChannelVideos`** (`nextjs/src/inngest/youtube/syncChannelVideos.ts`)
   - Event: `youtube/channel.sync`
   - 7 durable steps: set status → fetch channel → refresh token → update channel info → get uploads playlist → fetch all videos (paginated) → sync to DB → update timestamp
   - `onFailure`: resets `syncStatus` to idle, marks token invalid if auth error
   - Uses `NonRetriableError` for invalid tokens

3. **`updateVideoDescriptions`** (`nextjs/src/inngest/youtube/updateVideoDescriptions.ts`)
   - Event: `youtube/videos.update`
   - Concurrency limit: 5
   - 4 durable steps: fetch video data with relations → build descriptions from templates → update YouTube in batches of 10 → update DB + history
   - Helper `getValidAccessToken()` with token refresh + `NonRetriableError`

### Event Types
- `youtube/channel.sync` → `{ channelId: string; userId: string }`
- `youtube/videos.update` → `{ videoIds: string[]; userId: string }`

### Call Sites (13 `inngestClient.send()` calls)
| File | Line(s) | Event |
|------|---------|-------|
| `src/server/api/routers/dashboard/youtube.ts` | 62 | `youtube/channel.sync` |
| `src/server/api/routers/dashboard/youtube.ts` | 148, 272, 602, 688, 711 | `youtube/videos.update` |
| `src/lib/services/containers.ts` | 153 | `youtube/videos.update` |
| `src/lib/services/templates.ts` | 141 | `youtube/videos.update` |
| `src/lib/services/analytics.ts` | 172 | `youtube/channel.sync` |
| `src/lib/services/videos.ts` | 383, 486 | `youtube/videos.update` |
| `src/pages/api/auth/youtube/callback.ts` | 92, 128 | `youtube/channel.sync` |
| `src/inngest/youtube/scheduledSync.ts` | 29 | `youtube/channel.sync` (internal fan-out) |

### Env Variables
- `INNGEST_EVENT_KEY` (optional, in `src/env/schema.mjs:38`)
- `INNGEST_SIGNING_KEY` (optional, in `src/env/schema.mjs:39`)

## Plan

### Phase 1: Install & Configure Trigger.dev

1. Install packages:
   ```bash
   cd nextjs
   npm add @trigger.dev/sdk@latest
   npm add --save-dev @trigger.dev/build@latest
   ```

2. Create Trigger.dev project via dashboard or CLI (`npx trigger.dev@latest login && npx trigger.dev@latest init`)

3. Create `nextjs/trigger.config.ts`:
   ```typescript
   import { defineConfig } from "@trigger.dev/sdk/v3";
   import { syncVercelEnvVars } from "@trigger.dev/build/extensions/core";

   export default defineConfig({
     project: "<project-ref>",  // from dashboard
     runtime: "node",
     logLevel: "log",
     maxDuration: 720,  // 12 min, matching current Inngest config
     retries: {
       enabledInDev: false,
       default: {
         maxAttempts: 3,
         minTimeoutInMs: 1000,
         maxTimeoutInMs: 10000,
         factor: 2,
         randomize: true,
       },
     },
     dirs: ["./src/trigger"],
     build: {
       extensions: [syncVercelEnvVars()],
     },
   });
   ```
   Reference: ACS's `trigger.config.ts` at `/Users/ray/Desktop/agentic-coding-school/apps/nextjs/trigger.config.ts`

4. Add `trigger.config.ts` to `tsconfig.json` `include` array

5. Add `.trigger` to `.gitignore`

6. Add scripts to `package.json`:
   ```json
   "dev:trigger": "npx trigger.dev@latest dev",
   "deploy:trigger": "npx trigger.dev@latest deploy"
   ```

7. Add `TRIGGER_SECRET_KEY` to `.env.local` and Vercel env vars

### Phase 2: Port Inngest Functions to Trigger.dev Tasks

Create `nextjs/src/trigger/` directory with 3 task files.

#### A. `nextjs/src/trigger/scheduledSync.ts` — Cron Task

```typescript
import { schedules, tasks, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";

export const scheduledSync = schedules.task({
  id: "youtube-scheduled-sync",
  cron: "0 */6 * * *",
  run: async () => {
    const channels = await db
      .select({ id: youtubeChannels.id, userId: youtubeChannels.userId })
      .from(youtubeChannels);

    for (const channel of channels) {
      await tasks.trigger("youtube-sync-channel-videos", {
        channelId: channel.id,
        userId: channel.userId,
      });
    }

    logger.info("Scheduled sync complete", { channelsQueued: channels.length });
    return { success: true, channelsQueued: channels.length };
  },
});
```

**Translation notes:**
- `step.run('fetch-all-channels', ...)` and `step.run('trigger-channel-syncs', ...)` become plain inline code — no step wrappers needed
- `inngestClient.send()` becomes `tasks.trigger()`
- Cron is declarative in the task definition (auto-syncs on deploy)

#### B. `nextjs/src/trigger/syncChannelVideos.ts` — Event-Triggered Task

```typescript
import { task, AbortTaskRunError, logger } from "@trigger.dev/sdk/v3";
// ... same DB/service imports as current file
```

**Translation mapping:**
| Inngest | Trigger.dev |
|---------|-------------|
| `inngestClient.createFunction({id, onFailure}, {event}, fn)` | `task({ id, onFailure, run: fn })` |
| `event.data` | `payload` (first arg to `run`) |
| `step.run('name', fn)` | Just call `fn()` inline |
| `new NonRetriableError(msg)` | `throw new AbortTaskRunError(msg)` |
| `onFailure: async ({ event, error })` | `onFailure: async ({ payload, error })` |
| `event.data.event.data` (onFailure nested access) | `payload` (direct access) |

**Business logic is identical** — the 7 steps become sequential inline code without `step.run()` wrappers. Token refresh, channel info update, video pagination, DB sync, and timestamp update all stay the same.

**Important:** The `onFailure` signature changes. In Inngest, the failure event data is nested at `event.data.event.data`. In Trigger.dev, `payload` is the original payload directly.

#### C. `nextjs/src/trigger/updateVideoDescriptions.ts` — Event-Triggered with Concurrency

```typescript
import { task, AbortTaskRunError, queue, logger } from "@trigger.dev/sdk/v3";
// ... same DB/service imports
```

**Translation mapping:**
| Inngest | Trigger.dev |
|---------|-------------|
| `concurrency: { limit: 5 }` | `queue: { concurrencyLimit: 5 }` |
| Batched `step.run('update-youtube-batch-N', ...)` | Inline loop (or subtasks for checkpointing) |

**The helper `getValidAccessToken()`** stays as-is but swap `NonRetriableError` → `AbortTaskRunError`.

**Serialized types** (`SerializedChannel`, `SerializedVideo`, etc.) can likely be simplified since Trigger.dev doesn't JSON-serialize between steps the way Inngest does. The data flows through a single `run()` function now. Review whether these intermediate types are still needed.

### Phase 3: Update All Call Sites

Replace every `inngestClient.send()` with `tasks.trigger()` from `@trigger.dev/sdk/v3`.

**Before:**
```typescript
import { inngestClient } from "@/lib/clients/inngest";
await inngestClient.send({
  name: "youtube/channel.sync",
  data: { channelId, userId },
});
```

**After:**
```typescript
import { tasks } from "@trigger.dev/sdk/v3";
await tasks.trigger("youtube-sync-channel-videos", { channelId, userId });
```

**Files to update (13 call sites):**

1. `src/server/api/routers/dashboard/youtube.ts` — 6 calls:
   - Line 62: `youtube/channel.sync` → `tasks.trigger("youtube-sync-channel-videos", ...)`
   - Lines 148, 272, 602, 688, 711: `youtube/videos.update` → `tasks.trigger("youtube-update-video-descriptions", ...)`

2. `src/lib/services/containers.ts` — 1 call:
   - Line 153: `youtube/videos.update` → `tasks.trigger("youtube-update-video-descriptions", ...)`

3. `src/lib/services/templates.ts` — 1 call:
   - Line 141: `youtube/videos.update` → `tasks.trigger("youtube-update-video-descriptions", ...)`

4. `src/lib/services/analytics.ts` — 1 call:
   - Line 172: `youtube/channel.sync` → `tasks.trigger("youtube-sync-channel-videos", ...)`

5. `src/lib/services/videos.ts` — 2 calls:
   - Lines 383, 486: `youtube/videos.update` → `tasks.trigger("youtube-update-video-descriptions", ...)`

6. `src/pages/api/auth/youtube/callback.ts` — 2 calls:
   - Lines 92, 128: `youtube/channel.sync` → `tasks.trigger("youtube-sync-channel-videos", ...)`

### Phase 4: Update Env Schema

**File:** `nextjs/src/env/schema.mjs`

- Remove `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` (lines 38-39, 86-87)
- Add `TRIGGER_SECRET_KEY: z.string().optional()` (only needed at trigger time, not at build)

### Phase 5: Delete Inngest Code

1. Delete `nextjs/src/inngest/` directory (3 function files)
2. Delete `nextjs/src/lib/clients/inngest.ts` (client)
3. Delete `nextjs/src/pages/api/inngest.ts` (API route)
4. Run `npm uninstall inngest` from `nextjs/`

### Phase 6: Deploy & Verify

1. Deploy Trigger.dev tasks: `cd nextjs && npx trigger.dev@latest deploy`
2. Verify tasks appear in Trigger.dev dashboard with correct schedules
3. Set environment variables in Trigger.dev dashboard (or confirm `syncVercelEnvVars` is syncing them)
4. Push to main, verify Vercel deploy reaches READY
5. Test: trigger a manual channel sync from the dashboard and confirm it runs via Trigger.dev
6. Test: update a template and confirm `youtube-update-video-descriptions` fires
7. Wait for the next 6-hour cron tick (or trigger manually in dashboard) to verify `scheduledSync`
8. Remove `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from Vercel env vars

### Phase 7: CI/CD (Optional)

Add Trigger.dev deploy to GitHub Actions or Vercel build:
```yaml
- name: Deploy Trigger.dev tasks
  env:
    TRIGGER_ACCESS_TOKEN: ${{ secrets.TRIGGER_ACCESS_TOKEN }}
  run: npx trigger.dev@latest deploy
```

Or add to `vercel-build` script so tasks deploy alongside the app.

## Impact on Other Tasks

- **Description drift detection** (`tasks/to-do/description-drift-detection.md`) references Inngest files in its plan (Phase 2 & 3). If this migration lands first, update that task's file paths from `src/inngest/youtube/` to `src/trigger/`. The business logic changes described there are unaffected.

## Critical Files

### New files
- `nextjs/trigger.config.ts`
- `nextjs/src/trigger/scheduledSync.ts`
- `nextjs/src/trigger/syncChannelVideos.ts`
- `nextjs/src/trigger/updateVideoDescriptions.ts`

### Modified files
- `nextjs/src/server/api/routers/dashboard/youtube.ts`
- `nextjs/src/lib/services/containers.ts`
- `nextjs/src/lib/services/templates.ts`
- `nextjs/src/lib/services/analytics.ts`
- `nextjs/src/lib/services/videos.ts`
- `nextjs/src/pages/api/auth/youtube/callback.ts`
- `nextjs/src/env/schema.mjs`
- `nextjs/package.json`
- `nextjs/tsconfig.json`
- `nextjs/.gitignore`

### Deleted files
- `nextjs/src/inngest/youtube/scheduledSync.ts`
- `nextjs/src/inngest/youtube/syncChannelVideos.ts`
- `nextjs/src/inngest/youtube/updateVideoDescriptions.ts`
- `nextjs/src/lib/clients/inngest.ts`
- `nextjs/src/pages/api/inngest.ts`

## Reference Implementation

ACS (`/Users/ray/Desktop/agentic-coding-school/apps/nextjs/`) has a working Trigger.dev v4 setup with:
- `trigger.config.ts` — config with `syncVercelEnvVars()`, global `onSuccess`/`onFailure` hooks
- `src/trigger/transcription.ts` — task with `machine`, `maxDuration`, `retry.outOfMemory`, `onFailure`, `metadata.set()` for progress tracking
- `src/trigger/video-notifications.ts` — `schedules.task()` with cron, plus a regular `task()` for the actual work
- `src/server/api/routers/admin/trigger-jobs.ts` — calling `tasks.trigger()` and `tasks.batchTrigger()` from tRPC

## Acceptance Criteria

- [ ] Trigger.dev v4 SDK installed and `trigger.config.ts` created
- [ ] All 3 Inngest functions ported to `src/trigger/` as Trigger.dev tasks
- [ ] Scheduled sync runs on `0 */6 * * *` cron via Trigger.dev
- [ ] All 13 `inngestClient.send()` call sites updated to `tasks.trigger()`
- [ ] Concurrency limit of 5 preserved on `updateVideoDescriptions`
- [ ] `NonRetriableError` replaced with `AbortTaskRunError` everywhere
- [ ] `onFailure` handlers ported with correct payload access pattern
- [ ] Inngest package, client, API route, and function files deleted
- [ ] Env schema updated (Inngest vars removed, Trigger var added)
- [ ] Tasks deploy successfully to Trigger.dev
- [ ] Vercel deploy reaches READY
- [ ] Manual channel sync works end-to-end via Trigger.dev
- [ ] Template update triggers description rebuild via Trigger.dev
