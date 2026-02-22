import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
} from "@/lib/api-auth";
import { fetchChannelDetails } from "@/lib/clients/youtube";
import { db } from "@/db";
import {
  youtubeChannels,
  youtubeVideos,
  containers,
  templates,
} from "@/db/schema";
import { eq, and, count, isNull, sql, inArray } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;

  try {
    // Get the internal channel record
    const [channel] = await db
      .select()
      .from(youtubeChannels)
      .where(
        and(
          eq(youtubeChannels.channelId, channelId),
          eq(youtubeChannels.userId, auth.userId)
        )
      );

    if (!channel) {
      logRequest(auth, `/v1/channels/${channelId}/overview`, "GET", 404, 0);
      return NextResponse.json(
        apiError(
          "CHANNEL_NOT_FOUND",
          "Channel not found or not connected",
          "Connect a YouTube channel from the dashboard first",
          404
        ),
        { status: 404 }
      );
    }

    // Fetch YouTube details (real-time), templates, containers, and video counts in parallel
    const tokens = await getChannelTokens(channelId, auth.userId);
    if ("error" in tokens) {
      logRequest(
        auth,
        `/v1/channels/${channelId}/overview`,
        "GET",
        tokens.status,
        1
      );
      return NextResponse.json(tokens.error, { status: tokens.status });
    }

    const [youtubeDetails, userTemplates, userContainers, videoCounts] =
      await Promise.all([
        fetchChannelDetails(tokens.accessToken),
        db
          .select({
            id: templates.id,
            name: templates.name,
            variableCount:
              sql<number>`(SELECT COUNT(*) FROM regexp_matches(${templates.content}, '\\{\\{[^}]+\\}\\}', 'g'))`.as(
                "variable_count"
              ),
          })
          .from(templates)
          .where(eq(templates.userId, auth.userId)),
        db
          .select({
            id: containers.id,
            name: containers.name,
            videoCount: count(youtubeVideos.id),
          })
          .from(containers)
          .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
          .where(eq(containers.userId, auth.userId))
          .groupBy(containers.id),
        db
          .select({
            total: count().as("total"),
            assigned:
              sql<number>`COUNT(CASE WHEN ${youtubeVideos.containerId} IS NOT NULL THEN 1 END)`.as(
                "assigned"
              ),
            unassigned:
              sql<number>`COUNT(CASE WHEN ${youtubeVideos.containerId} IS NULL THEN 1 END)`.as(
                "unassigned"
              ),
          })
          .from(youtubeVideos)
          .where(eq(youtubeVideos.channelId, channel.id)),
      ]);

    const body = apiSuccess({
      channel: youtubeDetails,
      templates: {
        count: userTemplates.length,
        items: userTemplates,
      },
      containers: {
        count: userContainers.length,
        items: userContainers,
      },
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

    logRequest(auth, `/v1/channels/${channelId}/overview`, "GET", 200, 1);
    return NextResponse.json(body);
  } catch (error) {
    logRequest(auth, `/v1/channels/${channelId}/overview`, "GET", 500, 1);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch channel overview",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
