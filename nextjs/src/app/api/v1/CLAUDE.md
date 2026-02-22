# REST API Design Principles

This directory contains the VidTempla v1 REST API. All endpoints are agent-friendly and follow consistent patterns.

## Response Envelope

Every response uses the same envelope. Never return bare arrays or unwrapped objects.

```json
{
  "data": { ... },
  "error": null,
  "meta": { "cursor": "abc123", "hasMore": true, "total": 142 }
}
```

- `data` — the payload (object, array, or null on error)
- `error` — null on success, error object on failure
- `meta` — pagination info, request metadata (optional on non-list endpoints)

## Error Format

Every error includes a `suggestion` field so agents can self-correct.

```json
{
  "data": null,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The API key provided is invalid or expired",
    "suggestion": "Generate a new key from Settings > API Keys",
    "status": 401
  }
}
```

Standard error codes:
- `INVALID_API_KEY` (401) — bad or expired key
- `FORBIDDEN` (403) — key valid but no access to resource
- `NOT_FOUND` (404) — resource doesn't exist or belongs to another user
- `VALIDATION_ERROR` (400) — bad request body or query params
- `YOUTUBE_API_ERROR` (502) — upstream YouTube API failure
- `ANALYTICS_SCOPE_MISSING` (403) — channel needs reconnection for analytics
- `QUOTA_EXCEEDED` (429) — YouTube API quota limit hit
- `INTERNAL_ERROR` (500) — unexpected server error

## Cursor-Based Pagination

All list endpoints use cursor-based pagination. Never use offset-based pagination.

```
GET /api/v1/videos?cursor=abc123&limit=50
```

Response `meta`:
```json
{ "cursor": "next_cursor_value", "hasMore": true, "total": 142 }
```

- `cursor` — opaque string, pass as `?cursor=` for next page. Null on last page.
- `hasMore` — boolean, false on last page
- `total` — total count of matching records
- Default `limit` is 50, max is 100

## Field Selection

Proxy endpoints (YouTube Data API) support field selection to reduce payload size:

```
GET /api/v1/videos/abc?fields=id,title,viewCount,likeCount
```

VidTempla-native endpoints return all fields (they're already lean).

## Naming Conventions

- **URLs**: kebab-case (`/api/v1/youtube/playlists`)
- **JSON fields**: camelCase (`viewCount`, `subscriberCount`, `publishedAt`)
- **Query params**: camelCase (`channelId`, `startDate`, `maxResults`)

## YouTube API Quota Costs

Every proxy endpoint documents its YouTube API quota cost. Costs are tracked in `apiRequestLog.quotaUnits`.

| Operation | Quota Units |
|-----------|-------------|
| YouTube Data API reads (videos.list, channels.list) | 1 |
| YouTube search.list | 100 |
| YouTube write operations (playlists, comments, thumbnails) | 50 |
| Captions | 50-450 |
| VidTempla-native endpoints (templates, containers, usage) | 0 |
| Analytics API queries | Separate quota pool |

## Request Counting

Every API call is logged in `apiRequestLog` with:
- `apiKeyId` — which key made the request
- `endpoint` — the route path
- `method` — HTTP method
- `statusCode` — response status
- `quotaUnits` — YouTube quota consumed (0 for native endpoints)
- `createdAt` — timestamp

Usage is queryable via `GET /api/v1/usage`.

## Token Management

All YouTube proxy endpoints handle OAuth transparently:
1. `getChannelTokens(channelId, userId)` fetches and decrypts stored tokens
2. If the access token is expired, it auto-refreshes using the refresh token
3. The agent never sees or manages OAuth tokens directly
4. If a channel needs reconnection, the error response includes a suggestion

## User Isolation

Every query includes a `userId` filter. Users can only access their own data.

```ts
eq(table.userId, ctx.user.id)
```

This applies to both VidTempla-native and proxy endpoints (proxy endpoints verify channel ownership before making YouTube API calls).

## Adding New Endpoints

1. Create a route file under `app/api/v1/` following the directory structure
2. Import and call `withApiKey(request)` as the first line — this handles auth, returns `ApiContext`
3. Use `apiSuccess(data, meta?)` and `apiError(code, message, suggestion, status)` response helpers
4. For proxy endpoints, call `getChannelTokens()` to get the OAuth access token
5. Call `logRequest(ctx, endpoint, method, quotaUnits, statusCode)` before returning
6. Document the quota cost in this file

Example route structure:
```ts
import { NextRequest } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const ctx = await withApiKey(request);
  if (!ctx.success) return ctx.response;

  // ... endpoint logic ...

  await logRequest(ctx, "/api/v1/your-endpoint", "GET", 0, 200);
  return apiSuccess(data);
}
```
