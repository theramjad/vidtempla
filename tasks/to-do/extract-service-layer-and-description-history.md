# Plan: Extract Shared Service Layer + Add Description History Tools

## Context
MCP tools and REST API endpoints have nearly identical business logic — same DB queries, same joins, same pagination, same rebuild-trigger flows — but implemented independently in two places. This means every feature or bug fix needs to be applied twice. The user wants to consolidate this into shared functions.

Additionally, description history already works (the Inngest job saves each version after pushing to YouTube), but it's only accessible through the dashboard tRPC. The user wants agents to be able to query history and revert to previous descriptions via MCP (and REST for parity).

## Current State — What's Shared vs Duplicated

**Already shared** (low-level utilities both surfaces call):
- `getChannelTokens()` — `lib/api-auth.ts`
- `resolveVideo()` — `lib/api-auth.ts`
- `fetchVideoDetails/Analytics/Retention()` — `lib/clients/youtube.ts`
- `parseVariables/parseUserVariables()` — `utils/templateParser.ts`
- `checkVideoLimit()` — `lib/plan-limits.ts`
- `inngestClient.send()` — `lib/clients/inngest.ts`

**Duplicated** (same business logic, copy-pasted):
- `list_videos` query (filter building, joins, cursor pagination, total count) — MCP `tools/videos.ts:37-119` ≈ REST `api/v1/videos/route.ts:22-134`
- `get_video` query + YouTube fetch — MCP `tools/videos.ts:121-166` ≈ REST `api/v1/videos/[id]/route.ts:19-101`
- `assign_video` flow (limit check → verify container → update → init vars) — MCP `tools/videos.ts:262-343` ≈ REST `api/v1/videos/[id]/assign/route.ts:15-174`
- `update_video_variables` flow — MCP `tools/videos.ts:345-390` ≈ REST `api/v1/videos/[id]/variables/route.ts`
- Templates CRUD + rebuild-trigger logic — MCP `tools/templates.ts` ≈ REST `api/v1/templates/`
- Containers CRUD + rebuild-trigger logic — MCP `tools/containers.ts` ≈ REST `api/v1/containers/`
- Analytics queries — MCP `tools/analytics.ts` ≈ REST `api/v1/analytics/` + `api/v1/channels/*/analytics`
- Channel overview — MCP `tools/channels.ts:65-144` ≈ REST `api/v1/channels/[channelId]/overview/route.ts`

## Changes

### 1. Create service layer with typed results
**New directory:** `nextjs/src/lib/services/`

**New file:** `nextjs/src/lib/services/types.ts`
```ts
// All service functions return this
export type ServiceResult<T> =
  | { data: T }
  | { error: { code: string; message: string; suggestion: string; status: number } };

// Pagination options shared across list endpoints
export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  total: number;
}
```

### 2. Extract video service functions
**New file:** `nextjs/src/lib/services/videos.ts`

Functions to extract (moving business logic from both MCP and REST):
- `listVideos(userId, opts)` — filter/sort/paginate query
- `getVideo(id, userId)` — resolve + fetch DB + YouTube data
- `getVideoAnalytics(id, userId, opts)` — analytics query
- `getVideoRetention(id, userId)` — retention curve
- `getVideoVariables(id, userId)` — template variables
- `assignVideo(id, containerId, userId)` — limit check → assign → init vars
- `updateVideoVariables(id, variables, userId)` — update vars → trigger rebuild
- `getDescriptionHistory(videoId, userId)` — **NEW**: query history entries
- `revertDescription(videoId, historyId, userId)` — **NEW**: apply historical description

### 3. Extract template service functions
**New file:** `nextjs/src/lib/services/templates.ts`
- `listTemplates(userId, opts)`
- `getTemplate(id, userId)`
- `createTemplate(userId, name, content)`
- `updateTemplate(id, userId, data)` — includes rebuild-trigger logic
- `deleteTemplate(id, userId)`
- `getTemplateImpact(id, userId)`

### 4. Extract container service functions
**New file:** `nextjs/src/lib/services/containers.ts`
- `listContainers(userId, opts)`
- `getContainer(id, userId)`
- `createContainer(userId, name, templateIds, separator)`
- `updateContainer(id, userId, data)` — includes rebuild-trigger logic
- `deleteContainer(id, userId)`

### 5. Extract channel service functions
**New file:** `nextjs/src/lib/services/channels.ts`
- `listChannels(userId)`
- `getChannel(channelId, userId)` — live YouTube details
- `getChannelOverview(channelId, userId)` — dashboard summary

### 6. Extract analytics service functions
**New file:** `nextjs/src/lib/services/analytics.ts`
- `getChannelAnalytics(channelId, userId, opts)`
- `queryAnalytics(channelId, userId, opts)`
- `searchChannelVideos(channelId, userId, opts)`
- `syncChannel(channelId, userId)`

### 7. Refactor MCP tools to use services
**Modify:** `nextjs/src/lib/mcp/tools/{channels,videos,templates,containers,analytics}.ts`

Each tool becomes a thin wrapper:
```ts
server.tool("list_videos", "...", schema, async (args) => {
  const result = await listVideos(userId, args);
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
});
```

### 8. Refactor REST routes to use services
**Modify:** All route files under `nextjs/src/app/api/v1/`

Each route becomes a thin wrapper:
```ts
export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const result = await listVideos(auth.userId, parseQueryParams(request));
  if ("error" in result) {
    logRequest(auth, "/v1/videos", "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }
  logRequest(auth, "/v1/videos", "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data.data, result.data.meta));
}
```

### 9. Add description history MCP tools
**Modify:** `nextjs/src/lib/mcp/tools/videos.ts` — add two tools:

**`get_description_history`** (read-only)
- Input: `{ id: string (video UUID or YouTube ID), limit?: number }`
- Returns: array of `{ id, description, versionNumber, createdBy, createdAt }` ordered by versionNumber desc
- Agent uses this to see what changed and when

**`revert_description`** (write)
- Input: `{ id: string (video UUID or YouTube ID), historyId: string (history entry UUID) }`
- Behavior (same as dashboard tRPC `rollback`):
  1. Look up historical description by historyId
  2. Delink video from container (set containerId = null)
  3. Clear all video_variables for this video
  4. Set currentDescription to the historical description
  5. Trigger Inngest `youtube/videos.update` to push to YouTube
  6. Return `{ success: true, delinkedContainer: bool, variablesCleared: number }`
- This delinks because a reverted description is no longer template-driven

### 10. Add description history REST endpoints
**New file:** `nextjs/src/app/api/v1/videos/[id]/history/route.ts`
- `GET /v1/videos/:id/history` — same as `get_description_history`
- `POST /v1/videos/:id/history/:historyId/revert` — same as `revert_description` (requires write access)

Or alternatively, fold into existing `[id]/route.ts`.

## File Summary

| Action | File |
|--------|------|
| Create | `nextjs/src/lib/services/types.ts` |
| Create | `nextjs/src/lib/services/videos.ts` |
| Create | `nextjs/src/lib/services/templates.ts` |
| Create | `nextjs/src/lib/services/containers.ts` |
| Create | `nextjs/src/lib/services/channels.ts` |
| Create | `nextjs/src/lib/services/analytics.ts` |
| Simplify | `nextjs/src/lib/mcp/tools/videos.ts` — thin wrappers + 2 new history tools |
| Simplify | `nextjs/src/lib/mcp/tools/templates.ts` — thin wrappers |
| Simplify | `nextjs/src/lib/mcp/tools/containers.ts` — thin wrappers |
| Simplify | `nextjs/src/lib/mcp/tools/channels.ts` — thin wrappers |
| Simplify | `nextjs/src/lib/mcp/tools/analytics.ts` — thin wrappers |
| Simplify | `nextjs/src/app/api/v1/videos/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/videos/[id]/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/videos/[id]/assign/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/videos/[id]/variables/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/templates/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/templates/[id]/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/templates/[id]/impact/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/containers/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/containers/[id]/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/channels/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/channels/[channelId]/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/channels/[channelId]/overview/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/channels/[channelId]/analytics/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/channels/[channelId]/search/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/channels/[channelId]/sync/route.ts` — thin wrapper |
| Simplify | `nextjs/src/app/api/v1/analytics/query/route.ts` — thin wrapper |
| Create | `nextjs/src/app/api/v1/videos/[id]/history/route.ts` — description history GET |
| Create | `nextjs/src/app/api/v1/videos/[id]/history/[historyId]/revert/route.ts` — revert POST |

## Description History — No Schema Changes Needed

The `descriptionHistory` table already has everything we need:
- `id` (UUID PK) — used to identify specific versions for revert
- `videoId` (FK → youtubeVideos) — which video
- `description` (text) — full description text at that point in time
- `versionNumber` (int) — sequential version counter per video
- `createdBy` (FK → user) — who triggered the change
- `createdAt` (timestamp) — when it happened

History is written automatically:
- **On first sync** (`syncChannelVideos.ts`): creates version 1 with the original YouTube description
- **On every description update** (`updateVideoDescriptions.ts`): creates version N+1 with the new description after successful YouTube push

No migration or schema changes needed.

## Verification
1. `tsc --noEmit` — all types check
2. `next build` — builds successfully
3. Test MCP tools: `list_videos`, `get_description_history`, `revert_description`
4. Test REST API: `GET /v1/videos`, `GET /v1/videos/:id/history`, `POST /v1/videos/:id/history/:historyId/revert`
5. Verify existing MCP + REST functionality still works (no regressions)
6. Deploy to Vercel, confirm READY state
