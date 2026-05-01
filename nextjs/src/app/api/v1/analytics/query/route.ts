import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { queryAnalytics } from "@/lib/services/analytics";

export async function POST(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    channelId?: string;
    startDate?: string;
    endDate?: string;
    metrics?: string;
    dimensions?: string;
    filters?: string;
    sort?: string;
    maxResults?: number;
  };
  try {
    body = await request.json();
  } catch {
    logRequest(auth, "/analytics/query", "POST", 400, 0);
    return NextResponse.json(
      apiError("INVALID_BODY", "Request body must be valid JSON", "Send a JSON body with { channelId, startDate, endDate, metrics, dimensions?, filters?, sort?, maxResults? }", 400),
      { status: 400 }
    );
  }

  const { channelId, startDate, endDate, metrics } = body;

  if (!channelId || !startDate || !endDate || !metrics) {
    logRequest(auth, "/analytics/query", "POST", 400, 0);
    return NextResponse.json(
      apiError("MISSING_PARAMETER", "channelId, startDate, endDate, and metrics are required", "Provide all required fields. Example metrics: views,estimatedMinutesWatched,averageViewDuration. Dates in YYYY-MM-DD format.", 400),
      { status: 400 }
    );
  }

  const result = await queryAnalytics(auth.userId, body as {
    channelId: string;
    startDate: string;
    endDate: string;
    metrics: string;
    dimensions?: string;
    filters?: string;
    sort?: string;
    maxResults?: number;
  }, auth.organizationId);

  if ("error" in result) {
    logRequest(auth, "/analytics/query", "POST", result.error.status, 0);
    return NextResponse.json(apiError(result.error.code, result.error.message, result.error.suggestion, result.error.status), { status: result.error.status });
  }

  logRequest(auth, "/analytics/query", "POST", 200, 1);
  return NextResponse.json(apiSuccess(result.data, {
    quotaUnits: 1,
    note: "Analytics API has its own quota pool separate from Data API",
  }));
}
