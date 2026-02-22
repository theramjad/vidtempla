# Plan: Agent-Friendly REST API for VidTempla

## Context
VidTempla is pivoting to an API-first platform where AI agents securely manage YouTube channels. Instead of storing YouTube data ourselves, the API **proxies** YouTube's APIs on-demand — agents get real-time data, we handle the OAuth complexity. Paired with VidTempla's native template/container system for description management.

**Scope:**
- Data gathering (video stats, channel stats, analytics, search)
- Template & container management (CRUD, triggers description rebuilds)
- YouTube management (playlists, comments, thumbnails, captions)
- NO direct "push descriptions to YouTube" endpoint
- NO schema expansion for video/channel stats (proxy on-demand instead)
- NO description history/rollback endpoints

---

## Phase 1: Database + Infrastructure

### 1a. New `apiKeys` table
**File:** `nextjs/src/db/schema.ts`

```
api_keys: id (uuid PK), userId (FK->user CASCADE), name (text),
          keyHash (text, SHA-256), keyPrefix (text, "vtk_xxxx"),
          lastUsedAt (timestamp?), expiresAt (timestamp?), createdAt (timestamp)
```

### 1b. New `apiRequestLog` table (per-request tracking for billing)
**File:** `nextjs/src/db/schema.ts`

```
api_request_log: id (uuid PK), apiKeyId (FK->apiKeys CASCADE), userId (FK->user CASCADE),
                 endpoint (text), method (text, "GET"/"POST"/etc), statusCode (integer),
                 quotaUnits (integer, default 0),
                 createdAt (timestamp, defaultNow)
```

`quotaUnits` tracks YouTube API quota consumed by proxy endpoints. Each endpoint knows its cost:
- YouTube Data API reads (videos.list, channels.list, etc.): 1 unit
- YouTube search.list: 100 units
- YouTube write operations (playlists, comments, thumbnails): 50 units
- Captions: 50-450 units depending on operation
- VidTempla-native endpoints (templates, containers): 0 units
- Analytics API queries: counted separately (their own quota pool)

Index on `(userId, createdAt)` for billing queries. Every API request gets a row.

Run `npx drizzle-kit generate` + `npx drizzle-kit push` locally. Prompt user for remote.

### 1c. API key utilities
**New file:** `nextjs/src/lib/api-keys.ts`
- `generateApiKey()` — `crypto.randomBytes(32)`, prefix `vtk_`, returns `{ plaintext, hash, prefix }`
- `hashApiKey(key)` — SHA-256

### 1d. API auth middleware
**New file:** `nextjs/src/lib/api-auth.ts`

`withApiKey(request)` — the core middleware every route calls:
1. Extract `Authorization: Bearer vtk_...`
2. Hash key, look up in DB, check expiry
3. Return `ApiContext { user, apiKeyId }` or error response
4. **Log request** in `apiRequestLog` (endpoint, method, quotaUnits — fire-and-forget insert). Each route passes its quota cost to a `logRequest(ctx, endpoint, method, quotaUnits)` helper after the response is built (so statusCode is known).
5. Update `lastUsedAt` on `apiKeys` (fire-and-forget)

Response helpers:
- `apiSuccess(data, meta?)` → `{ data, error: null, meta }`
- `apiError(code, message, suggestion?, status)` → agent-friendly errors:
  ```json
  { "data": null, "error": { "code": "INVALID_API_KEY", "message": "...", "suggestion": "Generate a new key from Settings", "status": 401 } }
  ```

Helper to get user's YouTube channel tokens for proxying:
- `getChannelTokens(channelId, userId)` — fetches channel, decrypts tokens, refreshes if expired (reuse pattern from `syncChannelVideos.ts` lines 82-89). Returns `{ accessToken, channelId }` or error.

### 1e. Add `yt-analytics.readonly` to OAuth scopes (new connections only)
**File:** `nextjs/src/lib/clients/youtube.ts` (in `getOAuthUrl`)

Add `https://www.googleapis.com/auth/yt-analytics.readonly` to the scopes array. Only affects new OAuth flows. Existing users keep working for non-analytics endpoints. Analytics endpoints check for the scope and return a clear error with suggestion: `"Reconnect your channel from the dashboard to enable analytics"`. Consider adding a `hasAnalyticsScope` column to `youtubeChannels` (boolean, default false) to track who has the scope — set to true during new OAuth callbacks that include the analytics scope.

### 1f. Add YouTube Analytics client functions
**File:** `nextjs/src/lib/clients/youtube.ts`

New functions that call `https://youtubeanalytics.googleapis.com/v2/reports`:
- `fetchChannelAnalytics(accessToken, channelId, metrics, dimensions, startDate, endDate, filters?, sort?, maxResults?)`
- `fetchVideoAnalytics(accessToken, videoId, metrics, dimensions, startDate, endDate)`
- `fetchVideoRetention(accessToken, videoId)` — uses `elapsedVideoTimeRatio` dimension
- `queryAnalytics(accessToken, params)` — raw pass-through for flexible queries

New functions for YouTube Data API proxy:
- `fetchVideoDetails(accessToken, videoIds)` — `videos.list` with `part=snippet,statistics,contentDetails,status`
- `fetchChannelDetails(accessToken)` — `channels.list` with `part=snippet,statistics,contentDetails,brandingSettings`

---

## Phase 2: API Key Management (tRPC + UI)

### 2a. tRPC router
**New file:** `nextjs/src/server/api/routers/dashboard/apiKeys.ts`

Procedures (all `protectedProcedure`):
- `list` — user's keys (id, name, keyPrefix, lastUsedAt, expiresAt, createdAt)
- `create` — input `{ name, expiresInDays? }`, generates key, returns plaintext ONCE
- `revoke` — input `{ id }`, deletes with userId check
- `getUsage` — input `{ startDate?, endDate? }`, queries `apiRequestLog`, returns per-day counts and total

### 2b. Register router
**File:** `nextjs/src/server/api/root.ts` — add `apiKeys: apiKeysRouter` to dashboard router

### 2c. Settings page — API Keys section
**File:** `nextjs/src/pages/dashboard/settings.tsx`

New Card below existing cards:
- Table of keys (name, `vtk_****` prefix, last used, created, expires, request count from apiRequestLog)
- "Create API Key" → dialog with name + optional expiration
- After creation: copyable plaintext key + "won't be shown again" warning
- "Revoke" button per key with confirmation
- Usage summary: total requests this month

---

## Phase 3: REST API Endpoints

### File structure:
```
app/api/v1/
  # Meta
  usage/route.ts                               GET  (API usage stats)

  # Channels (VidTempla data + YouTube proxy)
  channels/route.ts                            GET  (list connected channels)
  channels/[channelId]/route.ts                GET  (channel full details from YouTube)
  channels/[channelId]/overview/route.ts       GET  (composite endpoint)
  channels/[channelId]/sync/route.ts           POST (trigger video sync)
  channels/[channelId]/analytics/route.ts      GET  (channel analytics)
  channels/[channelId]/search/route.ts         GET  (search within channel)

  # Videos (VidTempla data + YouTube proxy)
  videos/route.ts                              GET  (list from our DB)
  videos/[id]/route.ts                         GET  (video details + live stats from YouTube)
  videos/[id]/analytics/route.ts               GET  (video analytics)
  videos/[id]/retention/route.ts               GET  (audience retention curve)
  videos/[id]/assign/route.ts                  POST (assign to container)
  videos/[id]/variables/route.ts               GET, PUT

  # Templates (VidTempla native)
  templates/route.ts                           GET, POST
  templates/[id]/route.ts                      GET, PATCH, DELETE
  templates/[id]/impact/route.ts               GET  (affected videos/containers)

  # Containers (VidTempla native)
  containers/route.ts                          GET, POST
  containers/[id]/route.ts                     GET, PATCH, DELETE

  # YouTube Management (proxy)
  youtube/playlists/route.ts                   GET, POST
  youtube/playlists/[id]/route.ts              GET, PATCH, DELETE
  youtube/playlists/[id]/items/route.ts        GET, POST
  youtube/playlists/[id]/items/[itemId]/route.ts DELETE
  youtube/comments/[videoId]/route.ts          GET  (list comments for video)
  youtube/comments/reply/route.ts              POST (reply to a comment)
  youtube/comments/[commentId]/route.ts        DELETE
  youtube/thumbnails/[videoId]/route.ts        PUT  (upload custom thumbnail)
  youtube/captions/[videoId]/route.ts          GET  (list captions)

  # Analytics (YouTube Analytics API proxy)
  analytics/query/route.ts                     POST (flexible raw query)
```

**Total: 27 route files**

### Endpoint details:

#### Meta
- `GET /usage` — returns `{ daily: [{ date, requestCount, quotaUnits }], totals: { requests, quotaUnits }, periodStart, periodEnd }` from `apiRequestLog`

#### Channels
- `GET /channels` — list from our DB (id, channelId, title, thumbnailUrl, subscriberCount, syncStatus, lastSyncedAt)
- `GET /channels/:id` — proxies YouTube `channels.list` with full parts (snippet, statistics, contentDetails, brandingSettings). Real-time data.
- `GET /channels/:id/overview` — composite endpoint:
  ```json
  {
    "channel": { "from YouTube Data API - full stats" },
    "templates": { "count": 5, "items": [{ "id": "", "name": "", "variableCount": 0 }] },
    "containers": { "count": 3, "items": [{ "id": "", "name": "", "videoCount": 0 }] },
    "videos": { "total": 142, "assigned": 98, "unassigned": 44 },
    "descriptionHealth": { "withContainer": 98, "withoutContainer": 44, "lastSyncedAt": "", "syncStatus": "" }
  }
  ```
- `POST /channels/:id/sync` — triggers `youtube/channel.sync` Inngest event
- `GET /channels/:id/analytics?startDate=...&endDate=...&metrics=views,estimatedMinutesWatched&dimensions=day` — proxies YouTube Analytics API. Defaults to last 28 days, views + watch time by day.
- `GET /channels/:id/search?q=...&sort=date|viewCount|relevance&maxResults=25` — proxies YouTube `search.list` with `forMine=true` (100 quota units per call — document this)

#### Videos
- `GET /videos?channelId=...&containerId=...&search=...&unassigned=true&sort=publishedAt:desc&cursor=...&limit=50` — from our DB, cursor-paginated
- `GET /videos/:id` — our DB data PLUS proxies YouTube `videos.list` for live stats (viewCount, likeCount, commentCount, duration, tags, thumbnails, etc.)
- `GET /videos/:id/analytics?startDate=...&endDate=...&metrics=views,estimatedMinutesWatched,averageViewDuration` — per-video analytics from YouTube Analytics API
- `GET /videos/:id/retention` — audience retention curve. Returns 100 data points: `[{ position: 0.01, watchRatio: 0.95, relativePerformance: 0.8 }, ...]`
- `POST /videos/:id/assign` — assign to container (body: `{ containerId }`)
- `GET /videos/:id/variables` — get video variables with template info
- `PUT /videos/:id/variables` — update variables (body: `{ variables: [{ templateId, name, value }] }`, triggers Inngest rebuild)

#### Templates
- `GET /templates` — list with parsed variables, cursor-paginated
- `POST /templates` — create (body: `{ name, content }`)
- `GET /templates/:id` — single template with variables
- `PATCH /templates/:id` — update (body: `{ name?, content? }`, content change triggers Inngest rebuild)
- `DELETE /templates/:id`
- `GET /templates/:id/impact` — affected containers and video counts

#### Containers
- `GET /containers` — list with video counts, cursor-paginated
- `POST /containers` — create (body: `{ name, templateIds, separator? }`)
- `GET /containers/:id` — single container with template details
- `PATCH /containers/:id` — update (body: `{ name?, templateIds?, separator? }`, triggers Inngest rebuild)
- `DELETE /containers/:id`

#### YouTube Management (proxy)
- `GET /youtube/playlists?channelId=...` — list channel's playlists (1 quota unit)
- `POST /youtube/playlists` — create playlist (body: `{ title, description?, privacyStatus? }`, 50 units)
- `GET /youtube/playlists/:id` — playlist details (1 unit)
- `PATCH /youtube/playlists/:id` — update playlist (50 units)
- `DELETE /youtube/playlists/:id` — (50 units)
- `GET /youtube/playlists/:id/items` — list items (1 unit)
- `POST /youtube/playlists/:id/items` — add video (body: `{ videoId }`, 50 units)
- `DELETE /youtube/playlists/:id/items/:itemId` — remove item (50 units)
- `GET /youtube/comments/:videoId?maxResults=100&order=relevance|time` — list comment threads (1 unit)
- `POST /youtube/comments/reply` — reply to comment (body: `{ parentId, text }`, 50 units)
- `DELETE /youtube/comments/:commentId` — delete comment (50 units)
- `PUT /youtube/thumbnails/:videoId` — upload custom thumbnail (multipart, 50 units)
- `GET /youtube/captions/:videoId` — list available captions (50 units)

#### Analytics (flexible query)
- `POST /analytics/query` — raw pass-through to YouTube Analytics API:
  ```json
  {
    "channelId": "...",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "metrics": "views,estimatedMinutesWatched,averageViewDuration",
    "dimensions": "day",
    "filters": "video==VIDEO_ID",
    "sort": "-views",
    "maxResults": 10
  }
  ```
  This gives agents full power of the YouTube Analytics API without dealing with YouTube OAuth.

### Patterns applied:
- **Cursor pagination**: `?cursor=...&limit=50` → `meta: { cursor, hasMore, total }`
- **Field selection**: `?fields=id,title,viewCount` on proxy endpoints
- **Consistent errors**: `{ error: { code, message, suggestion, status } }`
- **User isolation**: `eq(table.userId, ctx.user.id)` WHERE clauses
- **Token management**: `getChannelTokens()` handles decrypt + refresh for all proxy endpoints
- **Request logging**: Every request inserts a row in `apiRequestLog` via middleware (endpoint, method, status code, quotaUnits)

### Key existing code to reuse:
- `nextjs/src/lib/clients/inngest.ts` — Inngest client for triggering events
- `nextjs/src/lib/plan-limits.ts` — `checkVideoLimit`, `getUserPlanTier`
- `nextjs/src/utils/templateParser.ts` — `parseVariables`, `parseUserVariables`
- `nextjs/src/utils/encryption.ts` — `decrypt` for YouTube tokens
- `nextjs/src/lib/clients/youtube.ts` — `refreshAccessToken` and existing YouTube helpers
- `nextjs/src/server/api/routers/dashboard/youtube.ts` — logic reference for all VidTempla-native endpoints

---

## Phase 4: API Design Principles Doc

### 4a. API folder CLAUDE.md
**New file:** `nextjs/src/app/api/v1/CLAUDE.md`

Documents the agent-friendly API design principles:
- Response envelope: `{ data, error, meta }` — never bare arrays
- Error format: `{ code, message, suggestion, status }` — always include suggestion
- Cursor-based pagination on all list endpoints
- Field selection support on proxy endpoints
- Consistent naming (camelCase for JSON, kebab-case for URLs)
- Every proxy endpoint documents its YouTube API quota cost
- Request counting — every call is tracked
- Token management — all YouTube proxy endpoints handle OAuth transparently
- User isolation patterns
- How to add new endpoints (follow the `withApiKey` pattern)

---

## Phase 5: API Documentation Page

### 5a. Docs page
**New file:** `nextjs/src/pages/docs/api.tsx`

Sections: Quick start (curl example), Authentication, Response format, Pagination, Endpoints reference (grouped by resource), YouTube quota info, Rate limits.

### 5b. Nav link
**File:** `nextjs/src/components/layout/Navbar.tsx` — add "API Docs" link

---

## Phase 6: Website Reframing

### 6a. Landing page
**File:** `nextjs/src/pages/index.tsx`

- **Badge**: "YouTube Channel Management for Agents"
- **Hero heading**: "Let AI Agents Securely Manage Your YouTube Channel"
- **Hero subheading**: REST API + dashboard for managing descriptions, gathering analytics, controlling playlists
- **Features**: Lead with REST API, add analytics/data gathering feature card
- **FAQ**: Add API questions

### 6b. App config
**File:** `nextjs/src/config/app.ts`
- `tagline`: → "Let AI agents manage your YouTube channel"

---

## Phase 7: CLAUDE.md Updates

**File:** `/Users/ray/Desktop/vidtempla/.claude/CLAUDE.md`

Add long-term vision section and REST API architecture reference.

---

## Implementation Order

1. **Phase 1** → Schema (apiKeys + apiUsage tables) + auth middleware + YouTube client expansion
2. **Phase 2** → API key management tRPC + Settings UI
3. **Phase 3** → REST endpoints (start with VidTempla-native, then YouTube proxy, then analytics)
4. **Phase 4** → API folder CLAUDE.md
5. **Phase 5** → Docs page
6. **Phase 6** → Landing page reframing
7. **Phase 7** → Project CLAUDE.md

Phases 2 and 3 can run in parallel after Phase 1.

---

## Verification

1. `npx drizzle-kit push` — schema applies locally
2. Create API key from Settings, verify plaintext shown once
3. `curl -H "Authorization: Bearer vtk_..." localhost:3000/api/v1/channels` → 200
4. Invalid key → 401 with `{ error: { code, message, suggestion } }`
5. `curl .../channels/:id/overview` → composite response
6. `curl .../videos/:id` → our DB data + live YouTube stats
7. `curl .../videos/:id/analytics?startDate=...&endDate=...` → analytics data
8. `curl .../videos/:id/retention` → 100-point retention curve
9. `curl .../youtube/playlists` → proxied YouTube playlists
10. `curl .../analytics/query` with POST body → flexible analytics
11. `curl .../usage` → shows request count incrementing
12. Create template via API → appears in dashboard
13. Update container via API → Inngest event fires
14. Check Settings page shows request counts per key
