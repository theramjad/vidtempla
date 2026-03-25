import { eq, and, count, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  youtubeChannels,
  youtubeVideos,
  containers,
  templates,
} from "@/db/schema";
import { getChannelTokens } from "@/lib/api-auth";
import { fetchChannelDetails } from "@/lib/clients/youtube";
import type { ServiceResult } from "./types";

// ── list_channels ────────────────────────────────────────────

export async function listChannels(
  userId: string
): Promise<ServiceResult<unknown>> {
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
      .where(eq(youtubeChannels.userId, userId))
      .orderBy(desc(youtubeChannels.createdAt));

    return { data: channels };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch channels", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_channel ──────────────────────────────────────────────

export async function getChannel(
  channelId: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const details = await fetchChannelDetails(tokens.accessToken);
    if (!details) {
      return { error: { code: "CHANNEL_NOT_FOUND", message: "YouTube channel not found", suggestion: "Check the channel ID", status: 404 } };
    }

    return { data: details };
  } catch {
    return { error: { code: "YOUTUBE_API_ERROR", message: "Failed to fetch channel details", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_channel_overview ─────────────────────────────────────

export async function getChannelOverview(
  channelId: string,
  userId: string
): Promise<ServiceResult<unknown>> {
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
      return { error: { code: "CHANNEL_NOT_FOUND", message: "Channel not found or not connected", suggestion: "Connect a YouTube channel from the dashboard first", status: 404 } };
    }

    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
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

    return {
      data: {
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
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch channel overview", suggestion: "Try again later", status: 500 } };
  }
}
