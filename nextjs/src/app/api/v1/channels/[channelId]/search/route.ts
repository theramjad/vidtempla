import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { searchChannelVideos } from "@/lib/services/analytics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  if (!q) {
    logRequest(auth, `/v1/channels/${channelId}/search`, "GET", 400, 0);
    return NextResponse.json(
      apiError("MISSING_QUERY", "Search query parameter 'q' is required", "Add ?q=your+search+terms to the URL", 400),
      { status: 400 }
    );
  }

  const result = await searchChannelVideos(channelId, auth.userId, {
    q,
    sort: url.searchParams.get("sort") ?? undefined,
    maxResults: url.searchParams.has("maxResults") ? parseInt(url.searchParams.get("maxResults")!) : undefined,
  });

  if ("error" in result) {
    logRequest(auth, `/v1/channels/${channelId}/search`, "GET", result.error.status, 100);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/channels/${channelId}/search`, "GET", 200, 100);
  return NextResponse.json(apiSuccess(result.data, {
    quotaCost: 100,
    note: "YouTube search.list costs 100 quota units per call",
  }));
}
