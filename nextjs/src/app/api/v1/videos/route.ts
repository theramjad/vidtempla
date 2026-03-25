import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { listVideos } from "@/lib/services/videos";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const result = await listVideos(auth.userId, {
    channelId: url.searchParams.get("channelId") ?? undefined,
    containerId: url.searchParams.get("containerId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    unassigned: url.searchParams.get("unassigned") === "true" || undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
  });

  if ("error" in result) {
    logRequest(auth, "/v1/videos", "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/videos", "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data.data, { ...result.data.meta }));
}
