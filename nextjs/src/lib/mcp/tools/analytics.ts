import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId } from "../helpers";
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
    async ({ channelId, ...opts }) => toMcp(await getChannelAnalytics(channelId, getSessionUserId(), opts))
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
    async (args) => toMcp(await queryAnalytics(getSessionUserId(), args))
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
    async ({ channelId, ...opts }) => toMcp(await searchChannelVideos(channelId, getSessionUserId(), opts))
  );

  server.tool(
    "sync_channel",
    "Trigger a video sync for a channel (imports new videos from YouTube)",
    { channelId: z.string().describe("YouTube channel ID") },
    async ({ channelId }) => toMcp(await syncChannel(channelId, getSessionUserId()))
  );
}
