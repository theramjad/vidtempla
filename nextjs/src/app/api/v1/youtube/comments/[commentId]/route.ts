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
 * DELETE /api/v1/youtube/comments/[commentId]?channelId=...
 * Delete a comment
 * Quota cost: 50 units
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  const { commentId } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/comments/${commentId}`, "DELETE", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId is required",
      "Provide a channelId query parameter",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, `/youtube/comments/${commentId}`, "DELETE", 0, 403);
    return tokens;
  }

  try {
    await axios.delete(`${YOUTUBE_API_BASE}/comments`, {
      params: { id: commentId },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/comments/${commentId}`, "DELETE", 50, 200);
    return apiSuccess({ deleted: true }, { quotaUnits: 50 });
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
    return apiError(
      "YOUTUBE_API_ERROR",
      message,
      "Check the comment ID and your permissions to delete it",
      status
    );
  }
}
