import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { checkDrift } from "@/lib/services/videos";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = await checkDrift(id, auth.userId, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/check-drift`, "POST", result.error.status, 1);
    return NextResponse.json(
      apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status, result.error.meta),
      { status: result.error.status }
    );
  }

  logRequest(auth, `/v1/videos/${id}/check-drift`, "POST", 200, 1);
  return NextResponse.json(apiSuccess(result.data));
}
