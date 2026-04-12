import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { resolveDrift } from "@/lib/services/videos";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { id } = await params;
  const body = await request.json();
  const result = await resolveDrift(id, auth.userId, auth.organizationId, body);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/resolve-drift`, "POST", result.error.status, 0);
    return NextResponse.json(
      apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status, result.error.meta),
      { status: result.error.status }
    );
  }

  logRequest(auth, `/v1/videos/${id}/resolve-drift`, "POST", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
