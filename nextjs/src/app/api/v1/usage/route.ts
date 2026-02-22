import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import { apiRequestLog } from "@/db/schema";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;

    const filters = [
      eq(apiRequestLog.userId, auth.userId),
      gte(apiRequestLog.createdAt, start),
      lte(apiRequestLog.createdAt, end),
    ];

    const daily = await db
      .select({
        date: sql<string>`DATE(${apiRequestLog.createdAt})`.as("date"),
        requestCount: count().as("request_count"),
        quotaUnits:
          sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
            "quota_units"
          ),
      })
      .from(apiRequestLog)
      .where(and(...filters))
      .groupBy(sql`DATE(${apiRequestLog.createdAt})`)
      .orderBy(sql`DATE(${apiRequestLog.createdAt})`);

    const [totals] = await db
      .select({
        requests: count().as("requests"),
        quotaUnits:
          sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
            "quota_units"
          ),
      })
      .from(apiRequestLog)
      .where(and(...filters));

    const body = apiSuccess(
      {
        daily,
        totals: {
          requests: totals?.requests ?? 0,
          quotaUnits: totals?.quotaUnits ?? 0,
        },
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      }
    );

    logRequest(auth, "/v1/usage", "GET", 200, 0);
    return NextResponse.json(body);
  } catch (error) {
    logRequest(auth, "/v1/usage", "GET", 500, 0);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch usage data", "Try again later", 500),
      { status: 500 }
    );
  }
}
