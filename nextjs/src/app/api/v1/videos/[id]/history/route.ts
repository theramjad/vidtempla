import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { getDescriptionHistory } from "@/lib/services/videos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const url = new URL(request.url);
  const limit = url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;

  const result = await getDescriptionHistory(id, auth.userId, limit, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/history`, "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/videos/${id}/history`, "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
