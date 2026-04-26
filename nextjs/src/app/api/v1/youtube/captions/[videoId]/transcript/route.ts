import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  getChannelTokens,
  logRequest,
} from "@/lib/api-auth";
import { mapYouTubeError } from "@/lib/youtube-errors";
import {
  listCaptionTracks,
  downloadCaptionTrack,
} from "@/lib/clients/youtube";
import { srtToPlainText } from "@/utils/srtParser";

/**
 * GET /api/v1/youtube/captions/[videoId]/transcript?channelId=...&captionId=...&language=...&format=text|srt|vtt
 * Download a video transcript
 * Quota cost: 200 units (with captionId) or 250 units (auto-select)
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
  const captionIdParam = searchParams.get("captionId");
  const languageParam = searchParams.get("language");
  const formatParam = searchParams.get("format") ?? "text";

  if (!channelId) {
    logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", 400, 0);
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

  if (!["text", "srt", "vtt"].includes(formatParam)) {
    logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", 400, 0);
    return NextResponse.json(
      apiError(
        "INVALID_PARAMETER",
        "format must be one of: text, srt, vtt",
        "Use format=text (default), format=srt, or format=vtt",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.userId);
  if ("error" in tokens) {
    logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", tokens.status, 0);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  let quotaUnits = 200;

  try {
    let captionId = captionIdParam;
    let language = "";
    let trackKind = "";

    if (!captionId) {
      // Auto-select: list tracks first (adds 50 quota units)
      const tracks = await listCaptionTracks(tokens.accessToken, videoId);
      quotaUnits = 250;

      if (tracks.length === 0) {
        logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", 404, 50);
        return NextResponse.json(
          apiError(
            "NO_CAPTIONS",
            "No caption tracks found for this video",
            "This video may not have captions available",
            404
          ),
          { status: 404 }
        );
      }

      // Filter by language if specified
      let selected = tracks;
      if (languageParam) {
        selected = tracks.filter((t) => t.snippet.language === languageParam);
        if (selected.length === 0) {
          logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", 404, 50);
          return NextResponse.json(
            apiError(
              "LANGUAGE_NOT_FOUND",
              `No caption track found for language: ${languageParam}`,
              `Available languages: ${tracks.map((t) => t.snippet.language).join(", ")}`,
              404
            ),
            { status: 404 }
          );
        }
      }

      // Sort: manual tracks first, then ASR
      const sorted = [...selected].sort((a, b) => {
        if (a.snippet.trackKind === "standard" && b.snippet.trackKind !== "standard") return -1;
        if (a.snippet.trackKind !== "standard" && b.snippet.trackKind === "standard") return 1;
        return 0;
      });

      const track = sorted[0]!;
      captionId = track.id;
      language = track.snippet.language;
      trackKind = track.snippet.trackKind;
    }

    // Download the caption track
    const tfmt = formatParam === "text" ? "srt" : formatParam;
    const raw = await downloadCaptionTrack(tokens.accessToken, captionId, tfmt);

    const transcript = formatParam === "text" ? srtToPlainText(raw) : raw;

    logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", 200, quotaUnits);
    return NextResponse.json(
      apiSuccess(
        { transcript, captionId, language, trackKind, format: formatParam },
        { quotaUnits }
      )
    );
  } catch (error) {
    const mapped = mapYouTubeError(error);
    logRequest(ctx, `/youtube/captions/${videoId}/transcript`, "GET", mapped.status, quotaUnits);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
