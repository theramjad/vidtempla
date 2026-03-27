import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { assignVideo } from "@/lib/services/videos";

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
  const { containerId } = body;

  if (!containerId) {
    logRequest(auth, `/v1/videos/${id}/assign`, "POST", 400, 0);
    return NextResponse.json(
      apiError("MISSING_CONTAINER_ID", "containerId is required in request body", 'Send { "containerId": "uuid" }', 400),
      { status: 400 }
    );
  }

  const result = await assignVideo(id, containerId, auth.userId, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/assign`, "POST", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/videos/${id}/assign`, "POST", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
