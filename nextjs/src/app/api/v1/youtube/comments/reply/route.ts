import { NextRequest, NextResponse } from "next/server";
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
 * POST /api/v1/youtube/comments/reply
 * Reply to a comment
 * Body: { channelId, parentId, text }
 * Quota cost: 50 units
 */
export async function POST(request: NextRequest) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;

  let body: { channelId?: string; parentId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    await logRequest(ctx, "/youtube/comments/reply", "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "INVALID_BODY",
        "Request body must be valid JSON",
        "Send a JSON body with { channelId, parentId, text }",
        400
      ),
      { status: 400 }
    );
  }

  const { channelId, parentId, text } = body;

  if (!channelId || !parentId || !text) {
    await logRequest(ctx, "/youtube/comments/reply", "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "MISSING_PARAMETER",
        "channelId, parentId, and text are required",
        "Provide channelId, parentId (the comment ID to reply to), and text in the body",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.userId);
  if ("error" in tokens) {
    await logRequest(ctx, "/youtube/comments/reply", "POST", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const response = await axios.post(
      `${YOUTUBE_API_BASE}/comments`,
      {
        snippet: {
          parentId,
          textOriginal: text,
        },
      },
      {
        params: { part: "snippet" },
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    await logRequest(ctx, "/youtube/comments/reply", "POST", 50, 201);
    return NextResponse.json(apiSuccess(response.data, { quotaUnits: 50 }));
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, "/youtube/comments/reply", "POST", 50, status);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Check that parentId is a valid comment ID and you have permission to reply",
        status
      ),
      { status }
    );
  }
}
