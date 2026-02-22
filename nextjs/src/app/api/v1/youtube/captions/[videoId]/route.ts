import { NextRequest } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  getChannelTokens,
  logRequest,
} from "@/lib/api-auth";
import axios from "axios";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * GET /api/v1/youtube/captions/[videoId]?channelId=...
 * List available captions for a video
 * Quota cost: 50 units
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  const { videoId } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId is required",
      "Provide a channelId query parameter",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", 0, 403);
    return tokens;
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/captions`, {
      params: {
        part: "snippet",
        videoId,
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", 50, 200);
    return apiSuccess(response.data.items || [], { quotaUnits: 50 });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", 50, status);
    return apiError(
      "YOUTUBE_API_ERROR",
      message,
      "Check the videoId is correct and you own this video",
      status
    );
  }
}
