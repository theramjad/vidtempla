import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { listChannels } from "@/lib/services/channels";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const result = await listChannels(auth.userId);

  if ("error" in result) {
    logRequest(auth, "/v1/channels", "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/channels", "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data));
}
