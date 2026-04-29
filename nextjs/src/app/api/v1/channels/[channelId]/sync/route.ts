import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { syncChannel } from "@/lib/services/analytics";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { channelId } = await params;
  const result = await syncChannel(channelId, auth.userId, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/channels/${channelId}/sync`, "POST", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/channels/${channelId}/sync`, "POST", 202, 0);
  return NextResponse.json(apiSuccess(result.data), { status: 202 });
}
