import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { queryAnalytics } from "@/lib/services/analytics";

const QuerySchema = z
  .object({
    channelId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    metrics: z.string().min(1).max(500),
    dimensions: z.string().max(500).optional(),
    filters: z.string().max(1000).optional(),
    sort: z.string().max(500).optional(),
    maxResults: z.number().int().positive().max(1000).optional(),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "startDate must be <= endDate",
    path: ["startDate"],
  });

export async function POST(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    logRequest(auth, "/analytics/query", "POST", 400, 0);
    return NextResponse.json(
      apiError("INVALID_BODY", "Request body must be valid JSON", "Send a JSON body with { channelId, startDate, endDate, metrics, dimensions?, filters?, sort?, maxResults? }", 400),
      { status: 400 }
    );
  }

  const parsed = QuerySchema.safeParse(rawBody);
  if (!parsed.success) {
    logRequest(auth, "/analytics/query", "POST", 400, 0);
    return NextResponse.json(
      apiError(
        "VALIDATION_ERROR",
        parsed.error.message,
        "Check field types and ranges. Required: channelId, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), metrics (comma-separated, e.g. views,estimatedMinutesWatched). Optional: dimensions, filters, sort (strings), maxResults (1-1000).",
        400
      ),
      { status: 400 }
    );
  }

  const body = parsed.data;

  const result = await queryAnalytics(auth.userId, body);

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
