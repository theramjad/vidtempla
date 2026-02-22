import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
} from "@/lib/api-auth";
import { db } from "@/db";
import { youtubeVideos, youtubeChannels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchVideoAnalytics } from "@/lib/clients/youtube";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Resolve internal video ID to YouTube video ID and channel
    const [video] = await db
      .select({
        videoId: youtubeVideos.videoId,
        channelId: youtubeChannels.channelId,
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(
        and(eq(youtubeVideos.id, id), eq(youtubeChannels.userId, auth.userId))
      );

    if (!video) {
      logRequest(auth, `/v1/videos/${id}/analytics`, "GET", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Check the video ID", 404),
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const now = new Date();
    const twentyEightDaysAgo = new Date(
      now.getTime() - 28 * 24 * 60 * 60 * 1000
    );

    const startDate =
      url.searchParams.get("startDate") ??
      twentyEightDaysAgo.toISOString().split("T")[0]!;
    const endDate =
      url.searchParams.get("endDate") ?? now.toISOString().split("T")[0]!;
    const metrics =
      url.searchParams.get("metrics") ??
      "views,estimatedMinutesWatched,averageViewDuration";
    const dimensions = url.searchParams.get("dimensions") ?? "day";

    const tokens = await getChannelTokens(video.channelId, auth.userId);
    if ("error" in tokens) {
      logRequest(
        auth,
        `/v1/videos/${id}/analytics`,
        "GET",
        tokens.status,
        0
      );
      return NextResponse.json(tokens.error, { status: tokens.status });
    }

    const data = await fetchVideoAnalytics(
      tokens.accessToken,
      video.videoId,
      metrics,
      dimensions,
      startDate,
      endDate
    );

    logRequest(auth, `/v1/videos/${id}/analytics`, "GET", 200, 0);
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    logRequest(auth, `/v1/videos/${id}/analytics`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "ANALYTICS_ERROR",
        "Failed to fetch video analytics",
        "Ensure your channel has analytics access",
        500
      ),
      { status: 500 }
    );
  }
}
