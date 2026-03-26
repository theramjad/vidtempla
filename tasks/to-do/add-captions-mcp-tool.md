# Add Captions/Transcript MCP Tool

## Context

AI agents using VidTempla's MCP server currently have no way to read video transcripts. Transcripts are essential for agents that analyze video content, generate descriptions, or optimize SEO. The YouTube Data API v3 provides `captions.list` (50 quota units) and `captions.download` (200 quota units) endpoints, and VidTempla already holds the required OAuth tokens with `youtube.force-ssl` scope.

There is an existing REST API endpoint at `nextjs/src/app/api/v1/youtube/captions/[videoId]/route.ts` that lists caption tracks, but it only calls `captions.list` -- there is no download/transcript retrieval yet anywhere in the codebase. The YouTube client (`nextjs/src/lib/clients/youtube.ts`) also has no caption functions.

## Design Decisions

**Two MCP tools, not one:**
- `list_video_captions` -- Lists available caption tracks for a video (language, name, auto vs manual). Agents need this to discover what languages are available before downloading. (50 quota units)
- `get_video_transcript` -- Downloads the actual transcript text for a specific caption track. This is the high-value tool agents will use most. (200 quota units)

**Why not a single tool?** A combined tool would always cost 250 quota units even when the agent just wants to check what languages are available. Splitting lets agents be quota-efficient.

**Output format for `get_video_transcript`:** Return plain text by default (most useful for LLM consumption), with an optional `format` parameter to get timed SRT/VTT when agents need timestamps. The YouTube API returns SRT by default; we'll strip timestamps for the plain-text mode by parsing the SRT response.

**Reuse strategy:** Create new YouTube client functions in `youtube.ts` and new service functions in a `captions.ts` service file. Do NOT call the REST endpoint internally -- follow the same pattern as `getVideoAnalytics`: resolveVideo -> getChannelTokens -> call YouTube API directly.

## Plan

### Step 1: Add YouTube client functions

**File:** `nextjs/src/lib/clients/youtube.ts`

Add two functions:

```ts
// Types
interface YouTubeCaptionTrack {
  id: string;
  snippet: {
    videoId: string;
    lastUpdated: string;
    trackKind: string;       // "standard" | "ASR" (auto-generated)
    language: string;         // BCP-47 language code
    name: string;
    audioTrackType: string;
    isCC: boolean;
    isAutoSynced: boolean;
    isDraft: boolean;
  };
}

// List caption tracks (50 quota units)
export async function listCaptionTracks(
  accessToken: string,
  videoId: string
): Promise<YouTubeCaptionTrack[]>

// Download caption track text (200 quota units)
// tfmt param: "srt" | "vtt" | "sbv" (YouTube API tfmt values)
export async function downloadCaptionTrack(
  accessToken: string,
  captionId: string,
  tfmt?: string
): Promise<string>
```

The `downloadCaptionTrack` function calls `GET https://www.googleapis.com/youtube/v3/captions/{id}` with the OAuth bearer token and optional `tfmt` query param. Note: this endpoint returns the raw caption file content (not JSON), so use `responseType: 'text'` with axios.

### Step 2: Add SRT-to-plain-text parser utility

**File:** `nextjs/src/utils/srtParser.ts`

A small utility to strip SRT timestamps and sequence numbers, returning just the spoken text with line breaks between cues. This keeps the YouTube client functions clean (they return raw API data) and puts the formatting logic in a reusable utility.

```ts
export function srtToPlainText(srt: string): string
```

### Step 3: Add captions service functions

**File:** `nextjs/src/lib/services/captions.ts`

Follow the exact pattern from `videos.ts` (resolveVideo -> getChannelTokens -> YouTube API call -> return ServiceResult):

```ts
import type { ServiceResult } from "./types";
import { resolveVideo, getChannelTokens } from "@/lib/api-auth";
import { listCaptionTracks, downloadCaptionTrack } from "@/lib/clients/youtube";
import { srtToPlainText } from "@/utils/srtParser";

// list_video_captions
export async function listVideoCaptions(
  videoId: string,    // VidTempla UUID or YouTube video ID
  userId: string
): Promise<ServiceResult<unknown>>

// get_video_transcript
export async function getVideoTranscript(
  videoId: string,    // VidTempla UUID or YouTube video ID
  userId: string,
  opts: {
    captionId?: string;   // Specific track ID (from list_video_captions)
    language?: string;    // Preferred language code (default: first available)
    format?: string;      // "text" (default) | "srt" | "vtt"
  }
): Promise<ServiceResult<unknown>>
```

**`getVideoTranscript` behavior:**
1. Resolve video, get tokens (standard pattern)
2. If no `captionId` provided, call `listCaptionTracks` to auto-select the best track:
   - If `language` specified, find matching track
   - Otherwise prefer manual tracks over ASR, then pick the first available
   - This costs an extra 50 units but is much better UX for agents
3. Call `downloadCaptionTrack` with `tfmt=srt`
4. If `format` is `"text"` (default), run `srtToPlainText()` on the result
5. If `format` is `"srt"` or `"vtt"`, pass the corresponding `tfmt` to the download call and return raw
6. Return `{ transcript, captionId, language, trackKind, format, quotaUnits }`

### Step 4: Register MCP tools

**File:** `nextjs/src/lib/mcp/tools/captions.ts`

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, READ } from "../helpers";
import { listVideoCaptions, getVideoTranscript } from "@/lib/services/captions";

function toMcp(result) { /* standard pattern */ }

export function registerCaptionTools(server: McpServer) {
  server.tool(
    "list_video_captions",
    "List available caption/subtitle tracks for a video (language, auto-generated vs manual). Costs 50 YouTube API quota units.",
    {
      videoId: z.string().describe("VidTempla UUID or YouTube video ID"),
    },
    READ,
    async ({ videoId }) => toMcp(await listVideoCaptions(videoId, getSessionUserId()))
  );

  server.tool(
    "get_video_transcript",
    "Download a video's transcript/captions text. Returns plain text by default. Costs 200-250 YouTube API quota units.",
    {
      videoId: z.string().describe("VidTempla UUID or YouTube video ID"),
      captionId: z.string().optional().describe("Specific caption track ID (from list_video_captions). If omitted, auto-selects best available track."),
      language: z.string().optional().describe("Preferred language code (e.g. 'en', 'es'). Used when captionId is not provided."),
      format: z.string().optional().describe("Output format: 'text' (default, plain transcript), 'srt' (with timestamps), 'vtt' (WebVTT with timestamps)"),
    },
    READ,
    async (args) => toMcp(await getVideoTranscript(args.videoId, getSessionUserId(), args))
  );
}
```

### Step 5: Register in the tool registry

**File:** `nextjs/src/lib/mcp/tools/register.ts`

Add:
```ts
import { registerCaptionTools } from "./captions";
```
And call `registerCaptionTools(server)` inside `registerAllTools()`.

### Step 6: Update the REST endpoint (optional, low priority)

The existing REST endpoint at `nextjs/src/app/api/v1/youtube/captions/[videoId]/route.ts` only does `captions.list`. Consider adding a `POST` handler or a separate `/download` sub-route that proxies `captions.download`. This is not required for the MCP tool but would keep the REST API feature-complete. Can be a follow-up task.

## Files Changed (Summary)

| File | Action |
|------|--------|
| `nextjs/src/lib/clients/youtube.ts` | Add `listCaptionTracks()` and `downloadCaptionTrack()` functions + types |
| `nextjs/src/utils/srtParser.ts` | New file -- SRT-to-plain-text parser |
| `nextjs/src/lib/services/captions.ts` | New file -- `listVideoCaptions()` and `getVideoTranscript()` service functions |
| `nextjs/src/lib/mcp/tools/captions.ts` | New file -- MCP tool registrations |
| `nextjs/src/lib/mcp/tools/register.ts` | Add import + call for `registerCaptionTools` |

## Quota Budget

- `list_video_captions`: 50 units per call
- `get_video_transcript` (with captionId): 200 units per call
- `get_video_transcript` (auto-select track): 250 units per call (50 for list + 200 for download)
- On a 10,000 unit daily quota: ~40 full transcript fetches/day, or ~200 caption list calls/day

## Acceptance Criteria

- [ ] `list_video_captions` MCP tool returns available caption tracks for a video (id, language, trackKind, name)
- [ ] `get_video_transcript` MCP tool returns transcript text, defaulting to plain text with timestamps stripped
- [ ] Both tools accept VidTempla UUID or YouTube video ID (via `resolveVideo`)
- [ ] Both tools use `READ` annotation
- [ ] `get_video_transcript` auto-selects the best caption track when `captionId` is not provided (prefers manual over ASR, respects `language` parameter)
- [ ] `get_video_transcript` supports `srt` and `vtt` format options for agents that need timestamps
- [ ] Proper error handling: video not found, no captions available, YouTube API errors
- [ ] Response includes metadata: `captionId`, `language`, `trackKind`, `format`, `quotaUnits`
- [ ] TypeScript compiles cleanly with no `any` types
- [ ] Deploys to Vercel without errors
