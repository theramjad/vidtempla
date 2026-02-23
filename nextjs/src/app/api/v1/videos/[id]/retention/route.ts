import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
  resolveVideo,
} from "@/lib/api-auth";
import { fetchVideoRetention } from "@/lib/clients/youtube";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const video = await resolveVideo(id, auth.userId);

    if (!video) {
      logRequest(auth, `/v1/videos/${id}/retention`, "GET", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID (e.g. dQw4w9WgXcQ)", 404),
        { status: 404 }
      );
    }

    const tokens = await getChannelTokens(video.channelYoutubeId, auth.userId);
    if ("error" in tokens) {
      logRequest(
        auth,
        `/v1/videos/${id}/retention`,
        "GET",
        tokens.status,
        0
      );
      return NextResponse.json(tokens.error, { status: tokens.status });
    }

    const rawData = await fetchVideoRetention(
      tokens.accessToken,
      video.videoId
    );

    // Transform into 100-point retention curve
    const retentionCurve = (rawData.rows ?? []).map((row) => ({
      position: row[0] as number,
      watchRatio: row[1] as number,
      relativePerformance: row[2] as number,
    }));

    logRequest(auth, `/v1/videos/${id}/retention`, "GET", 200, 0);
    return NextResponse.json(apiSuccess(retentionCurve));
  } catch (error) {
    logRequest(auth, `/v1/videos/${id}/retention`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "ANALYTICS_ERROR",
        "Failed to fetch retention data",
        "Ensure your channel has analytics access and the video has sufficient views",
        500
      ),
      { status: 500 }
    );
  }
}
