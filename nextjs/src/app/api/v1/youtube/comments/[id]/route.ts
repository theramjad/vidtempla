import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  requireWriteAccess,
  apiSuccess,
  apiError,
  getChannelTokens,
  logRequest,
} from "@/lib/api-auth";
import axios from "axios";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * GET /api/v1/youtube/comments/[id]?channelId=...&maxResults=100&order=relevance|time&pageToken=...
 * List comment threads for a video (id = videoId)
 * Quota cost: 1 unit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id: videoId } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const pageToken = searchParams.get("pageToken");
  const maxResults = Math.min(
    parseInt(searchParams.get("maxResults") || "20", 10),
    100
  );
  const order = searchParams.get("order") || "relevance";

  if (!channelId) {
    await logRequest(ctx, `/youtube/comments/${videoId}`, "GET", 0, 400);
    return NextResponse.json(
      apiError(
        "MISSING_PARAMETER",
        "channelId is required",
        "Provide a channelId query parameter to identify the channel",
        400
      ),
      { status: 400 }
    );
  }

  if (!["relevance", "time"].includes(order)) {
    await logRequest(ctx, `/youtube/comments/${videoId}`, "GET", 0, 400);
    return NextResponse.json(
      apiError(
        "INVALID_PARAMETER",
        "order must be 'relevance' or 'time'",
        "Use order=relevance for top comments or order=time for newest first",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.userId);
  if ("error" in tokens) {
    await logRequest(ctx, `/youtube/comments/${videoId}`, "GET", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/commentThreads`, {
      params: {
        part: "snippet,replies",
        videoId,
        maxResults,
        order,
        ...(pageToken && { pageToken }),
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/comments/${videoId}`, "GET", 1, 200);
    return NextResponse.json(
      apiSuccess(response.data.items || [], {
        quotaUnits: 1,
        pageInfo: response.data.pageInfo,
        nextPageToken: response.data.nextPageToken || null,
      })
    );
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/comments/${videoId}`, "GET", 1, status);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Check that the videoId is correct and comments are enabled",
        status
      ),
      { status }
    );
  }
}

/**
 * DELETE /api/v1/youtube/comments/[id]?channelId=...
 * Delete a comment (id = commentId)
 * Quota cost: 50 units
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;
  const writeCheck = requireWriteAccess(ctx);
  if (writeCheck) return writeCheck;

  const { id: commentId } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/comments/${commentId}`, "DELETE", 0, 400);
    return NextResponse.json(
      apiError(
        "MISSING_PARAMETER",
        "channelId is required",
        "Provide a channelId query parameter",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.userId);
  if ("error" in tokens) {
    await logRequest(ctx, `/youtube/comments/${commentId}`, "DELETE", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    await axios.delete(`${YOUTUBE_API_BASE}/comments`, {
      params: { id: commentId },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/comments/${commentId}`, "DELETE", 50, 200);
    return NextResponse.json(apiSuccess({ deleted: true }, { quotaUnits: 50 }));
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(
      ctx,
      `/youtube/comments/${commentId}`,
      "DELETE",
      50,
      status
    );
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Check the comment ID and your permissions to delete it",
        status
      ),
      { status }
    );
  }
}
