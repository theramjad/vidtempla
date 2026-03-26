import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, logMcpRequest, READ, WRITE, DESTRUCTIVE } from "../helpers";
import { consumeCredits } from "@/lib/plan-limits";
import {
  listVideos,
  getVideo,
  getVideoAnalytics,
  getVideoRetention,
  getVideoVariables,
  assignVideo,
  updateVideoVariables,
  getDescriptionHistory,
  revertDescription,
} from "@/lib/services/videos";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

export function registerVideoTools(server: McpServer) {
  server.tool(
    "list_videos",
    "List videos with filtering, sorting, and cursor pagination",
    {
      channelId: z.string().optional().describe("Filter by YouTube channel ID"),
      containerId: z.string().optional().describe("Filter by container UUID"),
      search: z.string().optional().describe("Search by video title"),
      unassigned: z.boolean().optional().describe("Only show unassigned videos"),
      sort: z.string().optional().describe("Sort field:direction, e.g. publishedAt:desc (default) or title:asc"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    READ,
    async (args) => {
      const userId = getSessionUserId();
      const result = await listVideos(userId, args);
      logMcpRequest(userId, "list_videos", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_video",
    "Get video details including live YouTube stats (accepts VidTempla UUID or YouTube video ID)",
    { id: z.string().describe("VidTempla UUID or YouTube video ID (e.g. dQw4w9WgXcQ)") },
    READ,
    async ({ id }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 1);
      if (!credits.success) {
        logMcpRequest(userId, "get_video", 0, 429);
        return mcpError("QUOTA_EXCEEDED", "Insufficient credits", "Upgrade your plan or wait for the next billing cycle");
      }
      const result = await getVideo(id, userId);
      logMcpRequest(userId, "get_video", 1, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_video_analytics",
    "Get video analytics over a date range (views, watch time, etc.)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 28 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
      metrics: z.string().optional().describe("Comma-separated metrics (default: views,estimatedMinutesWatched,averageViewDuration)"),
      dimensions: z.string().optional().describe("Dimensions (default: day)"),
    },
    READ,
    async ({ id, ...opts }) => {
      const userId = getSessionUserId();
      const result = await getVideoAnalytics(id, userId, opts);
      logMcpRequest(userId, "get_video_analytics", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_video_retention",
    "Get audience retention curve (100 data points with position, watchRatio, relativePerformance)",
    { id: z.string().describe("VidTempla UUID or YouTube video ID") },
    READ,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await getVideoRetention(id, userId);
      logMcpRequest(userId, "get_video_retention", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_video_variables",
    "Get template variables for a video",
    { id: z.string().describe("VidTempla UUID or YouTube video ID") },
    READ,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await getVideoVariables(id, userId);
      logMcpRequest(userId, "get_video_variables", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "assign_video",
    "Assign a video to a container (initializes template variables)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      containerId: z.string().describe("Container UUID to assign the video to"),
    },
    WRITE,
    async ({ id, containerId }) => {
      const userId = getSessionUserId();
      const result = await assignVideo(id, containerId, userId);
      logMcpRequest(userId, "assign_video", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "update_video_variables",
    "Update template variable values for a video and trigger description rebuild",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      variables: z.array(
        z.object({
          templateId: z.string().describe("Template UUID"),
          name: z.string().describe("Variable name"),
          value: z.string().describe("Variable value"),
        })
      ).describe("Array of variables to update"),
    },
    WRITE,
    async ({ id, variables }) => {
      const userId = getSessionUserId();
      const result = await updateVideoVariables(id, variables, userId);
      logMcpRequest(userId, "update_video_variables", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_description_history",
    "Get the version history of a video's description (ordered by most recent first)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      limit: z.number().optional().describe("Max entries to return (default 50, max 100)"),
    },
    READ,
    async ({ id, limit }) => {
      const userId = getSessionUserId();
      const result = await getDescriptionHistory(id, userId, limit);
      logMcpRequest(userId, "get_description_history", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "revert_description",
    "Revert a video's description to a previous version. This delinks the video from its container, clears all template variables, and pushes the historical description to YouTube.",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      historyId: z.string().describe("History entry UUID (from get_description_history)"),
    },
    DESTRUCTIVE,
    async ({ id, historyId }) => {
      const userId = getSessionUserId();
      const result = await revertDescription(id, historyId, userId);
      logMcpRequest(userId, "revert_description", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
