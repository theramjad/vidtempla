import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { searchYouTube } from "@/lib/services/analytics";

/**
 * GET /api/v1/youtube/search?channelId=...&q=...&type=video&sort=relevance&maxResults=10&pageToken=...&filterChannelId=...&publishedAfter=...&publishedBefore=...&regionCode=...&relevanceLanguage=...&videoCategoryId=...&videoDuration=...&eventType=...
 * Search all of YouTube (public search, not channel-scoped)
 * Quota cost: 100 units
 */
export async function GET(request: NextRequest) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId");
  const q = url.searchParams.get("q");

  if (!channelId) {
    await logRequest(ctx, "/youtube/search", "GET", 400, 0);
    return NextResponse.json(
      apiError("MISSING_PARAMETER", "channelId is required", "Provide your YouTube channel ID for OAuth authentication", 400),
      { status: 400 }
    );
  }

  if (!q) {
    await logRequest(ctx, "/youtube/search", "GET", 400, 0);
    return NextResponse.json(
      apiError("MISSING_PARAMETER", "q (search query) is required", "Add ?q=your+search+terms to the URL", 400),
      { status: 400 }
    );
  }

  const result = await searchYouTube(channelId, ctx.userId, {
    q,
    type: url.searchParams.get("type") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    maxResults: url.searchParams.has("maxResults") ? parseInt(url.searchParams.get("maxResults")!) : undefined,
    pageToken: url.searchParams.get("pageToken") ?? undefined,
    filterChannelId: url.searchParams.get("filterChannelId") ?? undefined,
    publishedAfter: url.searchParams.get("publishedAfter") ?? undefined,
    publishedBefore: url.searchParams.get("publishedBefore") ?? undefined,
    regionCode: url.searchParams.get("regionCode") ?? undefined,
    relevanceLanguage: url.searchParams.get("relevanceLanguage") ?? undefined,
    videoCategoryId: url.searchParams.get("videoCategoryId") ?? undefined,
    videoDuration: url.searchParams.get("videoDuration") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
  }, ctx.organizationId);

  if ("error" in result) {
    await logRequest(ctx, "/youtube/search", "GET", result.error.status, 100);
    return NextResponse.json(
      apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status),
      { status: result.error.status }
    );
  }

  await logRequest(ctx, "/youtube/search", "GET", 200, 100);
  return NextResponse.json(apiSuccess(result.data, {
    quotaCost: 100,
    note: "YouTube search.list costs 100 quota units per call",
  }));
}
