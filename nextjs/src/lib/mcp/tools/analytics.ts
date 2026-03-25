import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";
import { getChannelTokens } from "@/lib/api-auth";
import { fetchChannelAnalytics } from "@/lib/clients/youtube";
import { inngestClient } from "@/lib/clients/inngest";
import axios from "axios";
import { mcpJson, mcpError } from "../helpers";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";

export function registerAnalyticsTools(server: McpServer, userId: string) {
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
    async (args) => {
      try {
        const now = new Date();
        const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        const startDate = args.startDate ?? twentyEightDaysAgo.toISOString().split("T")[0]!;
        const endDate = args.endDate ?? now.toISOString().split("T")[0]!;
        const metrics = args.metrics ?? "views,estimatedMinutesWatched";
        const dimensions = args.dimensions ?? "day";

        const tokens = await getChannelTokens(args.channelId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const data = await fetchChannelAnalytics(tokens.accessToken, tokens.channelId, metrics, dimensions, startDate, endDate);
        return mcpJson(data);
      } catch {
        return mcpError("ANALYTICS_ERROR", "Failed to fetch channel analytics", "Ensure your channel has analytics access");
      }
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
    async (args) => {
      try {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(args.startDate) || !dateRegex.test(args.endDate)) {
          return mcpError("INVALID_PARAMETER", "Dates must be in YYYY-MM-DD format", "Use ISO date format, e.g. 2024-01-01");
        }

        const tokens = await getChannelTokens(args.channelId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const queryParams: Record<string, string | number> = {
          ids: `channel==${args.channelId}`,
          startDate: args.startDate,
          endDate: args.endDate,
          metrics: args.metrics,
        };
        if (args.dimensions) queryParams.dimensions = args.dimensions;
        if (args.filters) queryParams.filters = args.filters;
        if (args.sort) queryParams.sort = args.sort;
        if (args.maxResults) queryParams.maxResults = args.maxResults;

        const response = await axios.get(YOUTUBE_ANALYTICS_API, {
          params: queryParams,
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });

        return mcpJson(response.data);
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status || 500 : 500;
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error?.message || error.message
          : "Unknown error";

        if (status === 403 && message.includes("insufficient")) {
          return mcpError("MISSING_SCOPE", "Analytics scope not authorized", "Reconnect your channel from the dashboard to enable analytics");
        }

        return mcpError(
          "YOUTUBE_API_ERROR",
          message,
          "Check query parameters. Valid metrics: views, estimatedMinutesWatched, averageViewDuration, likes, comments, shares. Valid dimensions: day, month, country, video."
        );
      }
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
    async (args) => {
      try {
        const maxResults = Math.min(args.maxResults ?? 25, 50);

        const tokens = await getChannelTokens(args.channelId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const response = await axios.get(`${YOUTUBE_API_BASE}/search`, {
          params: {
            part: "snippet",
            forMine: true,
            type: "video",
            q: args.q,
            order: args.sort ?? "relevance",
            maxResults,
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });

        return mcpJson(response.data);
      } catch {
        return mcpError("YOUTUBE_API_ERROR", "Failed to search channel videos", "Try again later");
      }
    }
  );

  server.tool(
    "sync_channel",
    "Trigger a video sync for a channel (imports new videos from YouTube)",
    { channelId: z.string().describe("YouTube channel ID") },
    async ({ channelId }) => {
      try {
        const [channel] = await db
          .select({ id: youtubeChannels.id, syncStatus: youtubeChannels.syncStatus })
          .from(youtubeChannels)
          .where(and(eq(youtubeChannels.channelId, channelId), eq(youtubeChannels.userId, userId)));

        if (!channel) {
          return mcpError("CHANNEL_NOT_FOUND", "Channel not found or not connected", "Connect a YouTube channel from the dashboard first");
        }

        if (channel.syncStatus === "syncing") {
          return mcpError("SYNC_IN_PROGRESS", "A sync is already in progress", "Wait for the current sync to complete");
        }

        await inngestClient.send({
          name: "youtube/channel.sync",
          data: { channelId: channel.id, userId },
        });

        return mcpJson({ message: "Video sync started", jobId: `sync-${channel.id}-${Date.now()}` });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to trigger sync", "Try again later");
      }
    }
  );
}
