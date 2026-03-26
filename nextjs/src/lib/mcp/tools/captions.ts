import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toMcp, mcpQuotaExceeded, getSessionUserId, logMcpRequest, READ } from "../helpers";
import { consumeCredits } from "@/lib/plan-limits";
import { listVideoCaptions, getVideoTranscript } from "@/lib/services/captions";

export function registerCaptionTools(server: McpServer) {
  server.tool(
    "list_video_captions",
    "List available caption/subtitle tracks for a video (language, trackKind, auto-synced status)",
    { videoId: z.string().describe("VidTempla UUID or YouTube video ID") },
    READ,
    async ({ videoId }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 50);
      if (!credits.success) return mcpQuotaExceeded(userId, "list_video_captions");
      const result = await listVideoCaptions(videoId, userId);
      logMcpRequest(userId, "list_video_captions", 50, "error" in result ? 400 : 200);
      return toMcp(result);
    }
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
    async ({ videoId, captionId, language, format }) => {
      const userId = getSessionUserId();
      const quotaUnits = captionId ? 200 : 250;
      const credits = await consumeCredits(userId, quotaUnits);
      if (!credits.success) return mcpQuotaExceeded(userId, "get_video_transcript");
      const result = await getVideoTranscript(videoId, userId, { captionId, language, format });
      logMcpRequest(userId, "get_video_transcript", quotaUnits, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
