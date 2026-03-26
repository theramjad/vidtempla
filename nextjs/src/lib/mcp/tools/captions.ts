import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, READ } from "../helpers";
import { listVideoCaptions, getVideoTranscript } from "@/lib/services/captions";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

export function registerCaptionTools(server: McpServer) {
  server.tool(
    "list_video_captions",
    "List available caption/subtitle tracks for a video (language, trackKind, auto-synced status)",
    { videoId: z.string().describe("VidTempla UUID or YouTube video ID") },
    READ,
    async ({ videoId }) => toMcp(await listVideoCaptions(videoId, getSessionUserId()))
  );

  server.tool(
    "get_video_transcript",
    "Download a video's transcript as plain text, SRT, or VTT. Auto-selects the best caption track if no captionId is provided (prefers manual over auto-generated).",
    {
      videoId: z.string().describe("VidTempla UUID or YouTube video ID"),
      captionId: z.string().optional().describe("Specific caption track ID (from list_video_captions). If omitted, auto-selects best track."),
      language: z.string().optional().describe("Preferred language code (e.g. 'en', 'es'). Only used when auto-selecting."),
      format: z.enum(["text", "srt", "vtt"]).optional().describe("Output format: 'text' (plain text, default), 'srt', or 'vtt'"),
    },
    READ,
    async ({ videoId, captionId, language, format }) =>
      toMcp(await getVideoTranscript(videoId, getSessionUserId(), { captionId, language, format }))
  );
}
