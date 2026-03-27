import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { getChannelOverview } from "@/lib/services/channels";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;
  const result = await getChannelOverview(channelId, auth.userId, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/channels/${channelId}/overview`, "GET", result.error.status, 1);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/channels/${channelId}/overview`, "GET", 200, 1);
  return NextResponse.json(apiSuccess(result.data));
}
