import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { getTemplateImpact } from "@/lib/services/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = await getTemplateImpact(id, auth.userId, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, `/v1/templates/${id}/impact`, "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, `/v1/templates/${id}/impact`, "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
