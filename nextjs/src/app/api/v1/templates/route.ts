import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { listTemplates, createTemplate } from "@/lib/services/templates";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const result = await listTemplates(auth.organizationId, {
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
  });

  if ("error" in result) {
    logRequest(auth, "/v1/templates", "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/templates", "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data.data, { ...result.data.meta }));
}

export async function POST(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const body = await request.json();
  const { name, content } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    logRequest(auth, "/v1/templates", "POST", 400, 0);
    return NextResponse.json(
      apiError("INVALID_NAME", "name is required", 'Send { "name": "My Template", "content": "..." }', 400),
      { status: 400 }
    );
  }

  if (content === undefined || typeof content !== "string") {
    logRequest(auth, "/v1/templates", "POST", 400, 0);
    return NextResponse.json(
      apiError("INVALID_CONTENT", "content is required", 'Send { "name": "...", "content": "Template text with {{variables}}" }', 400),
      { status: 400 }
    );
  }

  const result = await createTemplate(auth.userId, auth.organizationId, name, content);

  if ("error" in result) {
    logRequest(auth, "/v1/templates", "POST", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/templates", "POST", 201, 0);
  return NextResponse.json(apiSuccess(result.data), { status: 201 });
}
