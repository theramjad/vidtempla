import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  youtubeChannels,
  youtubeVideos,
  containers,
  templates,
} from "@/db/schema";
import { getChannelTokens } from "@/lib/api-auth";
import { fetchChannelDetails } from "@/lib/clients/youtube";
import { mcpJson, mcpError } from "../helpers";

export function registerChannelTools(server: McpServer, userId: string) {
  server.tool(
    "list_channels",
    "List all connected YouTube channels",
    {},
    async () => {
      try {
        const channels = await db
          .select({
            id: youtubeChannels.id,
            channelId: youtubeChannels.channelId,
            title: youtubeChannels.title,
            thumbnailUrl: youtubeChannels.thumbnailUrl,
            subscriberCount: youtubeChannels.subscriberCount,
            syncStatus: youtubeChannels.syncStatus,
            lastSyncedAt: youtubeChannels.lastSyncedAt,
          })
          .from(youtubeChannels)
          .where(eq(youtubeChannels.userId, userId));

        return mcpJson(channels);
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch channels", "Try again later");
      }
    }
  );

  server.tool(
    "get_channel",
    "Get real-time YouTube channel details (costs 1 YouTube API quota unit)",
    { channelId: z.string().describe("YouTube channel ID (e.g. UCxxxxxx)") },
    async ({ channelId }) => {
      try {
        const tokens = await getChannelTokens(channelId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const details = await fetchChannelDetails(tokens.accessToken);
        if (!details) {
          return mcpError("CHANNEL_NOT_FOUND", "YouTube channel not found", "Check the channel ID");
        }

        return mcpJson(details);
      } catch {
        return mcpError("YOUTUBE_API_ERROR", "Failed to fetch channel details", "Try again later");
      }
    }
  );

  server.tool(
    "get_channel_overview",
    "Get channel overview with templates, containers, video counts, and description health (costs 1 YouTube API quota unit)",
    { channelId: z.string().describe("YouTube channel ID") },
    async ({ channelId }) => {
      try {
        const [channel] = await db
          .select()
          .from(youtubeChannels)
          .where(
            and(
              eq(youtubeChannels.channelId, channelId),
              eq(youtubeChannels.userId, userId)
            )
          );

        if (!channel) {
          return mcpError("CHANNEL_NOT_FOUND", "Channel not found or not connected", "Connect a YouTube channel from the dashboard first");
        }

        const tokens = await getChannelTokens(channelId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const [youtubeDetails, userTemplates, userContainers, videoCounts] =
          await Promise.all([
            fetchChannelDetails(tokens.accessToken),
            db
              .select({
                id: templates.id,
                name: templates.name,
                variableCount:
                  sql<number>`(SELECT COUNT(*) FROM regexp_matches(${templates.content}, '\\{\\{[^}]+\\}\\}', 'g'))`.as("variable_count"),
              })
              .from(templates)
              .where(eq(templates.userId, userId)),
            db
              .select({
                id: containers.id,
                name: containers.name,
                videoCount: count(youtubeVideos.id),
              })
              .from(containers)
              .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
              .where(eq(containers.userId, userId))
              .groupBy(containers.id),
            db
              .select({
                total: count().as("total"),
                assigned:
                  sql<number>`COUNT(CASE WHEN ${youtubeVideos.containerId} IS NOT NULL THEN 1 END)`.as("assigned"),
                unassigned:
                  sql<number>`COUNT(CASE WHEN ${youtubeVideos.containerId} IS NULL THEN 1 END)`.as("unassigned"),
              })
              .from(youtubeVideos)
              .where(eq(youtubeVideos.channelId, channel.id)),
          ]);

        return mcpJson({
          channel: youtubeDetails,
          templates: { count: userTemplates.length, items: userTemplates },
          containers: { count: userContainers.length, items: userContainers },
          videos: {
            total: videoCounts[0]?.total ?? 0,
            assigned: videoCounts[0]?.assigned ?? 0,
            unassigned: videoCounts[0]?.unassigned ?? 0,
          },
          descriptionHealth: {
            withContainer: videoCounts[0]?.assigned ?? 0,
            withoutContainer: videoCounts[0]?.unassigned ?? 0,
            lastSyncedAt: channel.lastSyncedAt,
            syncStatus: channel.syncStatus,
          },
        });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch channel overview", "Try again later");
      }
    }
  );
}
