import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { revertDescription } from "@/lib/services/videos";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { id, historyId } = await params;
  const result = await revertDescription(id, historyId, auth.userId, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/history/${historyId}/revert`, "POST", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/videos/${id}/history/${historyId}/revert`, "POST", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
