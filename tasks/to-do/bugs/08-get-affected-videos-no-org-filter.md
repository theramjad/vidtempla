# 08: `getAffectedVideos` enumerates videos by `containerId` with no org filter

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/server/api/routers/dashboard/youtube.ts:244`

## Bug
```ts
.where(eq(youtubeVideos.containerId, input.containerId))
```
No org/user filter. The sibling delete mutation correctly joins through `containers`.

## Impact
Any authenticated user can pass another org's container UUID and enumerate that org's video titles + YouTube IDs. UUIDs aren't a security boundary — they leak through logs, sentry breadcrumbs, screenshots.

## Fix
Join through `containers` and require `containers.organizationId = ctx.organizationId`:

```diff
- .where(eq(youtubeVideos.containerId, input.containerId))
+ .innerJoin(containers, eq(containers.id, youtubeVideos.containerId))
+ .where(and(
+   eq(youtubeVideos.containerId, input.containerId),
+   eq(containers.organizationId, ctx.organizationId)
+ ))
```

Or pre-check container ownership before the videos query.
