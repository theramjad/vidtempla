import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
} from "@/lib/api-auth";
import axios from "axios";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const sort = url.searchParams.get("sort") ?? "relevance";
    const maxResults = Math.min(
      parseInt(url.searchParams.get("maxResults") ?? "25"),
      50
    );

    if (!q) {
      logRequest(auth, `/v1/channels/${channelId}/search`, "GET", 400, 0);
      return NextResponse.json(
        apiError(
          "MISSING_QUERY",
          "Search query parameter 'q' is required",
          "Add ?q=your+search+terms to the URL",
          400
        ),
        { status: 400 }
      );
    }

    const tokens = await getChannelTokens(channelId, auth.userId);
    if ("error" in tokens) {
      logRequest(
        auth,
        `/v1/channels/${channelId}/search`,
        "GET",
        tokens.status,
        100
      );
      return NextResponse.json(tokens.error, { status: tokens.status });
    }

    const response = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: "snippet",
        forMine: true,
        type: "video",
        q,
        order: sort,
        maxResults,
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    logRequest(auth, `/v1/channels/${channelId}/search`, "GET", 200, 100);
    return NextResponse.json(
      apiSuccess(response.data, {
        quotaCost: 100,
        note: "YouTube search.list costs 100 quota units per call",
      })
    );
  } catch (error) {
    logRequest(auth, `/v1/channels/${channelId}/search`, "GET", 500, 100);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        "Failed to search channel videos",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
