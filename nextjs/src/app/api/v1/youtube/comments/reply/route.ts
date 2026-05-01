import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  requireWriteAccess,
  apiSuccess,
  apiError,
  getChannelTokens,
  logRequest,
} from "@/lib/api-auth";
import { mapYouTubeError } from "@/lib/youtube-errors";
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
  const writeCheck = requireWriteAccess(ctx);
  if (writeCheck) return writeCheck;

  let body: { channelId?: string; parentId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    await logRequest(ctx, "/youtube/comments/reply", "POST", 400, 0);
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
    await logRequest(ctx, "/youtube/comments/reply", "POST", 400, 0);
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

  const tokens = await getChannelTokens(channelId, ctx.userId, ctx.organizationId);
  if ("error" in tokens) {
    await logRequest(ctx, "/youtube/comments/reply", "POST", tokens.status, 0);
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

    await logRequest(ctx, "/youtube/comments/reply", "POST", 201, 50);
    return NextResponse.json(apiSuccess(response.data, { quotaUnits: 50 }));
  } catch (error) {
    const mapped = mapYouTubeError(error);
    await logRequest(ctx, "/youtube/comments/reply", "POST", mapped.status, 50);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
