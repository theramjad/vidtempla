import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { getChannelAnalytics } from "@/lib/services/analytics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;
  const url = new URL(request.url);

  const result = await getChannelAnalytics(channelId, auth.userId, {
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    metrics: url.searchParams.get("metrics") ?? undefined,
    dimensions: url.searchParams.get("dimensions") ?? undefined,
  });

  if ("error" in result) {
    logRequest(auth, `/v1/channels/${channelId}/analytics`, "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/channels/${channelId}/analytics`, "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
