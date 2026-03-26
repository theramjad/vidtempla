import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toMcp, mcpQuotaExceeded, getSessionUserId, logMcpRequest, READ, WRITE, DESTRUCTIVE } from "../helpers";
import { consumeCredits } from "@/lib/plan-limits";
import { listVideoCaptions, getVideoTranscript, insertCaption, updateCaption, deleteCaption } from "@/lib/services/captions";

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

  server.tool(
    "upload_caption",
    "Upload a new caption/subtitle track to a YouTube video. Accepts SRT, VTT, or SBV formatted content. For plain text without timestamps, set sync=true and YouTube will auto-generate timing from the audio.",
    {
      videoId: z.string().describe("VidTempla UUID or YouTube video ID"),
      language: z.string().describe("BCP-47 language code (e.g. 'en', 'es', 'fr', 'ja')"),
      name: z.string().describe("Caption track name shown in the YouTube player subtitle menu (max 150 chars)"),
      captionData: z.string().describe("Caption file content in SRT, VTT, or SBV format. For plain text transcripts, set sync=true."),
      isDraft: z.boolean().optional().describe("If true, caption is saved as draft (not visible to viewers). Default: false"),
      sync: z.boolean().optional().describe("If true, YouTube auto-generates timing from audio. Use when uploading plain text without timestamps. Default: false"),
    },
    WRITE,
    async ({ videoId, language, name, captionData, isDraft, sync }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 400);
      if (!credits.success) return mcpQuotaExceeded(userId, "upload_caption");
      const result = await insertCaption(videoId, userId, { language, name, captionData, isDraft, sync });
      logMcpRequest(userId, "upload_caption", 400, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "update_caption",
    "Update an existing caption track on a YouTube video. Can replace the caption file content, change draft status, or both. Use list_video_captions to find the caption track ID.",
    {
      videoId: z.string().describe("VidTempla UUID or YouTube video ID"),
      captionId: z.string().describe("Caption track ID to update (from list_video_captions)"),
      captionData: z.string().optional().describe("New caption file content in SRT, VTT, or SBV format. Omit to only change draft status."),
      isDraft: z.boolean().optional().describe("Set to false to publish a draft caption, or true to unpublish"),
    },
    WRITE,
    async ({ videoId, captionId, captionData, isDraft }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 450);
      if (!credits.success) return mcpQuotaExceeded(userId, "update_caption");
      const result = await updateCaption(videoId, userId, captionId, { captionData, isDraft });
      logMcpRequest(userId, "update_caption", 450, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "delete_caption",
    "Permanently delete a caption/subtitle track from a YouTube video. This cannot be undone. Use list_video_captions to find the caption track ID.",
    {
      videoId: z.string().describe("VidTempla UUID or YouTube video ID"),
      captionId: z.string().describe("Caption track ID to delete (from list_video_captions)"),
    },
    DESTRUCTIVE,
    async ({ videoId, captionId }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 50);
      if (!credits.success) return mcpQuotaExceeded(userId, "delete_caption");
      const result = await deleteCaption(videoId, userId, captionId);
      logMcpRequest(userId, "delete_caption", 50, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
