# Add MCP Tools for Comments/Playlists, Caption Editing, and Sidebar Reorder

## Context

VidTempla has REST API endpoints for comments, playlists, and captions, but only captions (list + download) are exposed as MCP tools. AI agents using the MCP server can't manage comments, playlists, or edit captions. This change adds full MCP coverage for all three domains, plus implements caption insert/update/delete (new YouTube API integration). Also reorders the sidebar to put "MCP Server" directly under "API Keys".

## Summary of Changes

| Area | New Files | Modified Files |
|------|-----------|----------------|
| YouTube client | -- | `clients/youtube.ts` (+14 functions) |
| Services | `services/comments.ts`, `services/playlists.ts` | `services/captions.ts` (+3 functions) |
| MCP tools | `mcp/tools/comments.ts`, `mcp/tools/playlists.ts` | `mcp/tools/captions.ts` (+3 tools), `mcp/tools/register.ts` |
| REST routes | -- | `captions/[videoId]/route.ts` (+POST/PUT/DELETE) |
| Sidebar | -- | `config/app.ts` (swap nav order) |

---

## Phase 1: YouTube Client Functions

**File: `nextjs/src/lib/clients/youtube.ts`**

Add 14 new exported functions in three sections:

### Caption write functions (after existing `downloadCaptionTrack`)
- `insertCaptionTrack(accessToken, videoId, language, name, captionData, isDraft?, sync?)` -- multipart POST to `https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet`; construct `multipart/related` body with JSON metadata + text/plain caption content
- `updateCaptionTrack(accessToken, captionId, captionData?, isDraft?)` -- two paths: if `captionData` provided, multipart PUT to upload URL; if metadata-only (`isDraft`), regular PUT to `YOUTUBE_API_BASE/captions?part=snippet` with JSON body
- `deleteCaptionTrack(accessToken, captionId)` -- DELETE to `YOUTUBE_API_BASE/captions?id={captionId}`

### Comment functions (new section)
- `listCommentThreads(accessToken, videoId, opts?)` -- GET `/commentThreads?part=snippet,replies&videoId=X`
- `replyToComment(accessToken, parentId, text)` -- POST `/comments?part=snippet`
- `deleteComment(accessToken, commentId)` -- DELETE `/comments?id=X`

### Playlist functions (new section)
- `listPlaylists(accessToken, channelId, opts?)` -- GET `/playlists?part=snippet,contentDetails,status&channelId=X`
- `createPlaylist(accessToken, title, description?, privacyStatus?)` -- POST `/playlists?part=snippet,status`
- `getPlaylist(accessToken, id)` -- GET `/playlists?part=snippet,contentDetails,status&id=X`
- `updatePlaylist(accessToken, id, mergedBody)` -- PUT `/playlists?part=snippet,status` (receives already-merged body)
- `deletePlaylist(accessToken, id)` -- DELETE `/playlists?id=X`
- `listPlaylistItems(accessToken, playlistId, opts?)` -- GET `/playlistItems?part=snippet,contentDetails&playlistId=X`
- `addPlaylistItem(accessToken, playlistId, videoId)` -- POST `/playlistItems?part=snippet`
- `deletePlaylistItem(accessToken, itemId)` -- DELETE `/playlistItems?id=X`

---

## Phase 2: Service Functions

### `nextjs/src/lib/services/comments.ts` (NEW)
Uses `getChannelTokens(channelId, userId)` pattern (no `resolveVideo` -- pure YouTube proxy).
- `listCommentThreads(videoId, channelId, userId, opts?)` -> `ServiceResult<{items, nextPageToken?}>`
- `replyToComment(channelId, parentId, text, userId)` -> `ServiceResult<comment>`
- `deleteComment(channelId, commentId, userId)` -> `ServiceResult<{deleted: true}>`

### `nextjs/src/lib/services/playlists.ts` (NEW)
Uses `getChannelTokens(channelId, userId)` pattern.
- `listPlaylists(channelId, userId, opts?)` -> `ServiceResult<{items, nextPageToken?}>`
- `createPlaylist(channelId, userId, opts)` -> `ServiceResult<playlist>`
- `getPlaylist(playlistId, channelId, userId)` -> `ServiceResult<playlist>`
- `updatePlaylist(playlistId, channelId, userId, updates)` -- prefetch + merge + PUT -> `ServiceResult<playlist>`
- `deletePlaylist(playlistId, channelId, userId)` -> `ServiceResult<{deleted: true}>`
- `listPlaylistItems(playlistId, channelId, userId, opts?)` -> `ServiceResult<{items, nextPageToken?}>`
- `addPlaylistItem(playlistId, channelId, userId, videoId)` -> `ServiceResult<item>`
- `deletePlaylistItem(itemId, channelId, userId)` -> `ServiceResult<{deleted: true}>`

### `nextjs/src/lib/services/captions.ts` (MODIFY)
Add after existing functions. Uses `resolveVideo` + `getChannelTokens` pattern (matching existing caption services).
- `insertCaption(videoId, userId, opts: {language, name, captionData, isDraft?, sync?})` -> `ServiceResult<CaptionTrackInfo>`
- `updateCaption(videoId, userId, captionId, opts: {captionData?, isDraft?})` -> `ServiceResult<CaptionTrackInfo>`
- `deleteCaption(videoId, userId, captionId)` -> `ServiceResult<{deleted: true}>`

---

## Phase 3: MCP Tools

### `nextjs/src/lib/mcp/tools/comments.ts` (NEW)
- `list_comment_threads` (READ, 1 unit) -- list top-level comment threads on a video
- `reply_to_comment` (WRITE, 50 units) -- post a reply to an existing comment
- `delete_comment` (DESTRUCTIVE, 50 units) -- permanently delete a comment

### `nextjs/src/lib/mcp/tools/playlists.ts` (NEW)
- `list_playlists` (READ, 1 unit) -- list all playlists on a channel
- `create_playlist` (WRITE, 50 units) -- create a new playlist
- `get_playlist` (READ, 1 unit) -- get details of a specific playlist
- `update_playlist` (WRITE, 50 units) -- update playlist title/description/privacy
- `delete_playlist` (DESTRUCTIVE, 50 units) -- permanently delete a playlist
- `list_playlist_items` (READ, 1 unit) -- list videos in a playlist
- `add_playlist_item` (WRITE, 50 units) -- add a video to a playlist
- `delete_playlist_item` (DESTRUCTIVE, 50 units) -- remove a video from a playlist

### `nextjs/src/lib/mcp/tools/captions.ts` (MODIFY -- add 3 tools)
- `upload_caption` (WRITE, 400 units) -- upload a new caption track
- `update_caption` (WRITE, 450 units) -- update an existing caption track
- `delete_caption` (DESTRUCTIVE, 50 units) -- delete a caption track

### `nextjs/src/lib/mcp/tools/register.ts` (MODIFY)
Add imports and calls for `registerCommentTools` and `registerPlaylistTools`.

---

## Phase 4: Caption REST Routes

**File: `nextjs/src/app/api/v1/youtube/captions/[videoId]/route.ts` (MODIFY)**

Add three handlers to the existing file (which currently only has GET):

- **POST** -- upload new caption (400 quota). Body: `{channelId, language, name, captionData, isDraft?, sync?}`
- **PUT** -- update caption (450 quota). Body: `{channelId, captionId, captionData?, isDraft?}`
- **DELETE** -- delete caption (50 quota). Query: `?channelId=&captionId=`

All require `requireWriteAccess(ctx)`.

---

## Phase 5: Sidebar Reorder

**File: `nextjs/src/config/app.ts`**

Change navigation order from: Dashboard -> API Keys -> Usage -> MCP Server
To: Dashboard -> API Keys -> MCP Server -> Usage

---

## Key Design Decisions

1. **Comments/playlists use `channelId` directly, not `resolveVideo`** -- these are pure YouTube proxies where the video/resource doesn't need to exist in VidTempla's DB
2. **Caption MCP tools use `resolveVideo`** -- matching the existing `list_video_captions` and `get_video_transcript` pattern (accepts VidTempla UUID or YouTube ID)
3. **Caption REST routes use direct client calls** -- matching existing REST route pattern (REST routes don't go through service layer)
4. **Multipart body as string** -- no external library; construct `multipart/related` boundary manually (consistent with minimal-dependency approach)
5. **`updateCaptionTrack` two-path** -- metadata-only update uses regular JSON PUT; file update uses multipart PUT

## Acceptance Criteria

- [ ] `cd nextjs && npx tsc --noEmit` passes
- [ ] MCP tools visible and callable via MCP server
- [ ] REST endpoints respond correctly with valid API key
- [ ] Sidebar shows MCP Server directly below API Keys
- [ ] Vercel deployment succeeds
