import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError } from "../helpers";
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

export function registerVideoTools(server: McpServer, userId: string) {
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
    async (args) => toMcp(await listVideos(userId, args))
  );

  server.tool(
    "get_video",
    "Get video details including live YouTube stats (accepts VidTempla UUID or YouTube video ID)",
    { id: z.string().describe("VidTempla UUID or YouTube video ID (e.g. dQw4w9WgXcQ)") },
    async ({ id }) => toMcp(await getVideo(id, userId))
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
    async ({ id, ...opts }) => toMcp(await getVideoAnalytics(id, userId, opts))
  );

  server.tool(
    "get_video_retention",
    "Get audience retention curve (100 data points with position, watchRatio, relativePerformance)",
    { id: z.string().describe("VidTempla UUID or YouTube video ID") },
    async ({ id }) => toMcp(await getVideoRetention(id, userId))
  );

  server.tool(
    "get_video_variables",
    "Get template variables for a video",
    { id: z.string().describe("VidTempla UUID or YouTube video ID") },
    async ({ id }) => toMcp(await getVideoVariables(id, userId))
  );

  server.tool(
    "assign_video",
    "Assign a video to a container (initializes template variables)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      containerId: z.string().describe("Container UUID to assign the video to"),
    },
    async ({ id, containerId }) => toMcp(await assignVideo(id, containerId, userId))
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
    async ({ id, variables }) => toMcp(await updateVideoVariables(id, variables, userId))
  );

  server.tool(
    "get_description_history",
    "Get the version history of a video's description (ordered by most recent first)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      limit: z.number().optional().describe("Max entries to return (default 50, max 100)"),
    },
    async ({ id, limit }) => toMcp(await getDescriptionHistory(id, userId, limit))
  );

  server.tool(
    "revert_description",
    "Revert a video's description to a previous version. This delinks the video from its container, clears all template variables, and pushes the historical description to YouTube.",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      historyId: z.string().describe("History entry UUID (from get_description_history)"),
    },
    async ({ id, historyId }) => toMcp(await revertDescription(id, historyId, userId))
  );
}
