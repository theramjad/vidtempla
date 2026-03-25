import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { listContainers, createContainer } from "@/lib/services/containers";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const result = await listContainers(auth.userId, {
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
  });

  if ("error" in result) {
    logRequest(auth, "/v1/containers", "GET", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/containers", "GET", 200, 0);
  return NextResponse.json(apiSuccess(result.data.data, { ...result.data.meta }));
}

export async function POST(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const body = await request.json();
  const { name, templateIds, separator } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    logRequest(auth, "/v1/containers", "POST", 400, 0);
    return NextResponse.json(
      apiError("INVALID_NAME", "name is required", 'Send { "name": "My Container", "templateIds": ["..."] }', 400),
      { status: 400 }
    );
  }

  if (!Array.isArray(templateIds)) {
    logRequest(auth, "/v1/containers", "POST", 400, 0);
    return NextResponse.json(
      apiError("INVALID_TEMPLATE_IDS", "templateIds must be an array of template UUIDs", 'Send { "name": "...", "templateIds": ["template-uuid-1", "template-uuid-2"] }', 400),
      { status: 400 }
    );
  }

  const result = await createContainer(auth.userId, name, templateIds, separator);

  if ("error" in result) {
    logRequest(auth, "/v1/containers", "POST", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/v1/containers", "POST", 201, 0);
  return NextResponse.json(apiSuccess(result.data), { status: 201 });
}
