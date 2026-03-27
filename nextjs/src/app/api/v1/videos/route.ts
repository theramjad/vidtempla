import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { listVideos } from "@/lib/services/videos";
import { consumeCredits } from "@/lib/plan-limits";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId") ?? undefined;

  if (!channelId) {
    logRequest(auth, "/v1/videos", "GET", 400, 0);
    return NextResponse.json(
      apiError("VALIDATION_ERROR", "channelId is required", "Pass ?channelId=UC... to sync and list videos", 400),
      { status: 400 }
    );
  }

  const credits = await consumeCredits(auth.organizationId, 2);
  if (!credits.success) {
    logRequest(auth, "/v1/videos", "GET", 429, 0);
    return NextResponse.json(
      apiError("QUOTA_EXCEEDED", "Insufficient credits", "Upgrade your plan or wait for credits to reset", 429),
      { status: 429 }
    );
  }

  const result = await listVideos(auth.userId, {
    channelId,
    containerId: url.searchParams.get("containerId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    unassigned: url.searchParams.get("unassigned") === "true" || undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
  }, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, "/v1/videos", "GET", result.error.status, 2);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/videos", "GET", 200, 2);
  return NextResponse.json(apiSuccess(result.data.data, { ...result.data.meta }));
}
