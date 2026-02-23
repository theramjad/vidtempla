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

/**
 * PUT /api/v1/youtube/thumbnails/[videoId]?channelId=...
 * Upload a custom thumbnail for a video
 * Content-Type: multipart/form-data or image/* (raw binary)
 * Quota cost: 50 units
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
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/thumbnails/${videoId}`, "PUT", 0, 400);
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
    await logRequest(ctx, `/youtube/thumbnails/${videoId}`, "PUT", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  // Handle multipart or raw image upload
  const contentType = request.headers.get("content-type") || "";
  let imageBuffer: Buffer;
  let imageContentType: string;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("thumbnail") as File | null;
      if (!file) {
        await logRequest(
          ctx,
          `/youtube/thumbnails/${videoId}`,
          "PUT",
          0,
          400
        );
        return NextResponse.json(
          apiError(
            "MISSING_PARAMETER",
            "thumbnail file is required in form data",
            'Upload an image file with the field name "thumbnail"',
            400
          ),
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      imageContentType = file.type || "image/png";
    } else if (contentType.startsWith("image/")) {
      const arrayBuffer = await request.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      imageContentType = contentType;
    } else {
      await logRequest(ctx, `/youtube/thumbnails/${videoId}`, "PUT", 0, 400);
      return NextResponse.json(
        apiError(
          "INVALID_CONTENT_TYPE",
          "Request must be multipart/form-data or image/*",
          'Send the image as multipart/form-data with field "thumbnail", or as raw binary with Content-Type: image/png (or image/jpeg)',
          400
        ),
        { status: 400 }
      );
    }

    // Validate image size (YouTube limit: 2 MB)
    if (imageBuffer.length > 2 * 1024 * 1024) {
      await logRequest(ctx, `/youtube/thumbnails/${videoId}`, "PUT", 0, 400);
      return NextResponse.json(
        apiError(
          "FILE_TOO_LARGE",
          "Thumbnail must be under 2 MB",
          "Resize or compress your image to under 2 MB",
          400
        ),
        { status: 400 }
      );
    }

    const response = await axios.post(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set`,
      imageBuffer,
      {
        params: { videoId },
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": imageContentType,
        },
        maxContentLength: 3 * 1024 * 1024,
      }
    );

    await logRequest(ctx, `/youtube/thumbnails/${videoId}`, "PUT", 50, 200);
    return NextResponse.json(apiSuccess(response.data, { quotaUnits: 50 }));
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/thumbnails/${videoId}`, "PUT", 50, status);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Ensure the image is a valid JPEG/PNG under 2 MB and the video ID is correct",
        status
      ),
      { status }
    );
  }
}
