import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { getVideoVariables, updateVideoVariables } from "@/lib/services/videos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = await getVideoVariables(id, auth.userId);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/variables`, "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/videos/${id}/variables`, "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { id } = await params;
  const body = await request.json();
  const { variables } = body;

  if (!Array.isArray(variables)) {
    logRequest(auth, `/v1/videos/${id}/variables`, "PUT", 400, 0);
    return NextResponse.json(
      apiError("INVALID_BODY", "Request body must contain a 'variables' array", 'Send { "variables": [{ "templateId": "...", "name": "...", "value": "..." }] }', 400),
      { status: 400 }
    );
  }

  const result = await updateVideoVariables(id, variables, auth.userId);

  if ("error" in result) {
    logRequest(auth, `/v1/videos/${id}/variables`, "PUT", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/videos/${id}/variables`, "PUT", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
