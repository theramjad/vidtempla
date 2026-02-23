import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
  resolveVideo,
} from "@/lib/api-auth";
import { db } from "@/db";
import {
  youtubeVideos,
  youtubeChannels,
  containers,
} from "@/db/schema";
import { eq, and, getTableColumns } from "drizzle-orm";
import { fetchVideoDetails } from "@/lib/clients/youtube";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Resolve to internal ID (accepts both UUID and YouTube video ID)
    const resolved = await resolveVideo(id, auth.userId);
    if (!resolved) {
      logRequest(auth, `/v1/videos/${id}`, "GET", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID (e.g. dQw4w9WgXcQ)", 404),
        { status: 404 }
      );
    }

    // Get our DB data with full details
    const [video] = await db
      .select({
        ...getTableColumns(youtubeVideos),
        channel: {
          id: youtubeChannels.id,
          channelId: youtubeChannels.channelId,
          title: youtubeChannels.title,
          userId: youtubeChannels.userId,
        },
        container: {
          id: containers.id,
          name: containers.name,
        },
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
      .where(eq(youtubeVideos.id, resolved.id));

    if (!video) {
      logRequest(auth, `/v1/videos/${id}`, "GET", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID (e.g. dQw4w9WgXcQ)", 404),
        { status: 404 }
      );
    }

    // Get live stats from YouTube
    const tokens = await getChannelTokens(video.channel.channelId, auth.userId);
    let youtubeData = null;

    if (!("error" in tokens)) {
      try {
        const details = await fetchVideoDetails(tokens.accessToken, [
          video.videoId,
        ]);
        youtubeData = details[0] ?? null;
      } catch {
        // YouTube fetch failed - return DB data only
      }
    }

    logRequest(auth, `/v1/videos/${id}`, "GET", 200, youtubeData ? 1 : 0);
    return NextResponse.json(
      apiSuccess({
        ...video,
        youtube: youtubeData,
      })
    );
  } catch (error) {
    logRequest(auth, `/v1/videos/${id}`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch video details",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
