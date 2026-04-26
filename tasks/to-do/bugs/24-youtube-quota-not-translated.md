# 24: YouTube `quotaExceeded` not translated to documented `QUOTA_EXCEEDED` / 429

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/app/api/v1/youtube/playlists/route.ts:69-86`
- `nextjs/src/app/api/v1/youtube/captions/[videoId]/transcript/route.ts:136-152`
- Same pattern in other YouTube proxy error handlers

## Bug
Catches axios errors and returns `code: "YOUTUBE_API_ERROR"` with raw upstream status (403 for quota). Doesn't inspect `error.response.data.error.errors[].reason === 'quotaExceeded'`.

## Impact
Docs (`api/v1/CLAUDE.md:44`) promise agents a stable `QUOTA_EXCEEDED` / 429 to back off on. Instead they see `YOUTUBE_API_ERROR` / 403 — indistinguishable from a permission failure. Agents can't implement quota-aware retry.

## Fix
Shared YouTube error mapper used by every proxy route:

```ts
// lib/youtube-errors.ts
export function mapYouTubeError(err: AxiosError) {
  const reason = (err.response?.data as any)?.error?.errors?.[0]?.reason;
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return { code: "QUOTA_EXCEEDED", message: "YouTube API quota exhausted",
      suggestion: "Wait for daily reset (Pacific midnight)", status: 429 };
  }
  if (err.response?.status === 404) {
    return { code: "NOT_FOUND", ... };
  }
  return { code: "YOUTUBE_API_ERROR", message: err.message,
    suggestion: "Check YouTube API status", status: err.response?.status ?? 500 };
}
```
