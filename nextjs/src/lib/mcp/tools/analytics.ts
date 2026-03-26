import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, logMcpRequest, READ, WRITE } from "../helpers";
import { consumeCredits } from "@/lib/plan-limits";
import {
  getChannelAnalytics,
  queryAnalytics,
  searchChannelVideos,
  syncChannel,
} from "@/lib/services/analytics";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    "get_channel_analytics",
    "Get channel-level analytics over a date range",
    {
      channelId: z.string().describe("YouTube channel ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 28 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
      metrics: z.string().optional().describe("Comma-separated metrics (default: views,estimatedMinutesWatched)"),
      dimensions: z.string().optional().describe("Dimensions (default: day)"),
    },
    READ,
    async ({ channelId, ...opts }) => {
      const userId = getSessionUserId();
      const result = await getChannelAnalytics(channelId, userId, opts);
      logMcpRequest(userId, "get_channel_analytics", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "query_analytics",
    "Flexible YouTube Analytics API query. Supports any valid metrics, dimensions, filters, and sort parameters.",
    {
      channelId: z.string().describe("YouTube channel ID"),
      startDate: z.string().describe("Start date YYYY-MM-DD"),
      endDate: z.string().describe("End date YYYY-MM-DD"),
      metrics: z.string().describe("Comma-separated metrics (e.g. views,estimatedMinutesWatched,averageViewDuration)"),
      dimensions: z.string().optional().describe("Dimensions (e.g. day, month, country, video)"),
      filters: z.string().optional().describe("Filters (e.g. video==dQw4w9WgXcQ)"),
      sort: z.string().optional().describe("Sort field (e.g. -views)"),
      maxResults: z.number().optional().describe("Max results"),
    },
    READ,
    async (args) => {
      const userId = getSessionUserId();
      const result = await queryAnalytics(userId, args);
      logMcpRequest(userId, "query_analytics", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "search_channel_videos",
    "Search a channel's videos on YouTube (costs 100 YouTube API quota units)",
    {
      channelId: z.string().describe("YouTube channel ID"),
      q: z.string().describe("Search query"),
      sort: z.string().optional().describe("Sort order: relevance (default), date, viewCount, rating"),
      maxResults: z.number().optional().describe("Max results (default 25, max 50)"),
    },
    READ,
    async ({ channelId, ...opts }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 100);
      if (!credits.success) {
        logMcpRequest(userId, "search_channel_videos", 0, 429);
        return mcpError("QUOTA_EXCEEDED", "Insufficient credits", "Upgrade your plan or wait for the next billing cycle");
      }
      const result = await searchChannelVideos(channelId, userId, opts);
      logMcpRequest(userId, "search_channel_videos", 100, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "sync_channel",
    "Trigger a video sync for a channel (imports new videos from YouTube)",
    { channelId: z.string().describe("YouTube channel ID") },
    WRITE,
    async ({ channelId }) => {
      const userId = getSessionUserId();
      const result = await syncChannel(channelId, userId);
      logMcpRequest(userId, "sync_channel", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
