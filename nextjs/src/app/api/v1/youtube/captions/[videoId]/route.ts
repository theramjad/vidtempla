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
import {
  insertCaptionTrack,
  updateCaptionTrack,
  deleteCaptionTrack,
} from "@/lib/clients/youtube";
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
  if (ctx instanceof NextResponse) return ctx;

  const { videoId } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", 400, 0);
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

  const tokens = await getChannelTokens(channelId, ctx.userId, ctx.organizationId);
  if ("error" in tokens) {
    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", tokens.status, 0);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/captions`, {
      params: {
        part: "snippet",
        videoId,
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", 200, 50);
    return NextResponse.json(apiSuccess(response.data.items || [], { quotaUnits: 50 }));
  } catch (error) {
    const mapped = mapYouTubeError(error);
    await logRequest(ctx, `/youtube/captions/${videoId}`, "GET", mapped.status, 50);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

/**
 * POST /api/v1/youtube/captions/[videoId]
 * Upload a new caption track
 * Quota cost: 400 units
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;
  const writeCheck = requireWriteAccess(ctx);
  if (writeCheck) return writeCheck;

  const { videoId } = await params;
  const endpoint = `/youtube/captions/${videoId}`;

  let body: { channelId?: string; language?: string; name?: string; captionData?: string; isDraft?: boolean; sync?: boolean };
  try {
    body = await request.json();
  } catch {
    logRequest(ctx, endpoint, "POST", 400, 0);
    return NextResponse.json(apiError("VALIDATION_ERROR", "Invalid JSON body", "Send a JSON body with channelId, language, name, and captionData", 400), { status: 400 });
  }

  const { channelId, language, name, captionData, isDraft, sync } = body;
  if (!channelId || !language || !name || !captionData) {
    logRequest(ctx, endpoint, "POST", 400, 0);
    return NextResponse.json(apiError("VALIDATION_ERROR", "channelId, language, name, and captionData are required", "Provide all required fields in the request body", 400), { status: 400 });
  }

  const tokens = await getChannelTokens(channelId, ctx.userId, ctx.organizationId);
  if ("error" in tokens) {
    logRequest(ctx, endpoint, "POST", tokens.status, 0);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const track = await insertCaptionTrack(tokens.accessToken, videoId, language, name, captionData, isDraft, sync);
    logRequest(ctx, endpoint, "POST", 200, 400);
    return NextResponse.json(apiSuccess(track, { quotaUnits: 400 }));
  } catch (error) {
    const mapped = mapYouTubeError(error);
    logRequest(ctx, endpoint, "POST", mapped.status, 400);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

/**
 * PUT /api/v1/youtube/captions/[videoId]
 * Update an existing caption track
 * Quota cost: 450 units
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;
  const writeCheck = requireWriteAccess(ctx);
  if (writeCheck) return writeCheck;

  const { videoId } = await params;
  const endpoint = `/youtube/captions/${videoId}`;

  let body: { channelId?: string; captionId?: string; captionData?: string; isDraft?: boolean };
  try {
    body = await request.json();
  } catch {
    logRequest(ctx, endpoint, "PUT", 400, 0);
    return NextResponse.json(apiError("VALIDATION_ERROR", "Invalid JSON body", "Send a JSON body with channelId, captionId, and optionally captionData/isDraft", 400), { status: 400 });
  }

  const { channelId, captionId, captionData, isDraft } = body;
  if (!channelId || !captionId) {
    logRequest(ctx, endpoint, "PUT", 400, 0);
    return NextResponse.json(apiError("VALIDATION_ERROR", "channelId and captionId are required", "Provide channelId and captionId in the request body", 400), { status: 400 });
  }

  const tokens = await getChannelTokens(channelId, ctx.userId, ctx.organizationId);
  if ("error" in tokens) {
    logRequest(ctx, endpoint, "PUT", tokens.status, 0);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const track = await updateCaptionTrack(tokens.accessToken, captionId, captionData, isDraft);
    logRequest(ctx, endpoint, "PUT", 200, 450);
    return NextResponse.json(apiSuccess(track, { quotaUnits: 450 }));
  } catch (error) {
    const mapped = mapYouTubeError(error);
    logRequest(ctx, endpoint, "PUT", mapped.status, 450);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

/**
 * DELETE /api/v1/youtube/captions/[videoId]?channelId=...&captionId=...
 * Delete a caption track
 * Quota cost: 50 units
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;
  const writeCheck = requireWriteAccess(ctx);
  if (writeCheck) return writeCheck;

  const { videoId } = await params;
  const endpoint = `/youtube/captions/${videoId}`;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const captionId = searchParams.get("captionId");

  if (!channelId || !captionId) {
    logRequest(ctx, endpoint, "DELETE", 400, 0);
    return NextResponse.json(apiError("VALIDATION_ERROR", "channelId and captionId query parameters are required", "Provide ?channelId=...&captionId=...", 400), { status: 400 });
  }

  const tokens = await getChannelTokens(channelId, ctx.userId, ctx.organizationId);
  if ("error" in tokens) {
    logRequest(ctx, endpoint, "DELETE", tokens.status, 0);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    await deleteCaptionTrack(tokens.accessToken, captionId);
    logRequest(ctx, endpoint, "DELETE", 200, 50);
    return NextResponse.json(apiSuccess({ deleted: true }, { quotaUnits: 50 }));
  } catch (error) {
    const mapped = mapYouTubeError(error);
    logRequest(ctx, endpoint, "DELETE", mapped.status, 50);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
