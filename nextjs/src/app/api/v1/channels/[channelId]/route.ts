import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
} from "@/lib/api-auth";
import { fetchChannelDetails } from "@/lib/clients/youtube";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;

  try {
    const tokens = await getChannelTokens(channelId, auth.userId);
    if ("error" in tokens) {
      logRequest(auth, `/v1/channels/${channelId}`, "GET", tokens.status, 1);
      return NextResponse.json(tokens.error, { status: tokens.status });
    }

    const details = await fetchChannelDetails(tokens.accessToken);
    if (!details) {
      logRequest(auth, `/v1/channels/${channelId}`, "GET", 404, 1);
      return NextResponse.json(
        apiError(
          "CHANNEL_NOT_FOUND",
          "YouTube channel not found",
          "Check the channel ID and try again",
          404
        ),
        { status: 404 }
      );
    }

    logRequest(auth, `/v1/channels/${channelId}`, "GET", 200, 1);
    return NextResponse.json(apiSuccess(details));
  } catch (error) {
    logRequest(auth, `/v1/channels/${channelId}`, "GET", 500, 1);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        "Failed to fetch channel details from YouTube",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
