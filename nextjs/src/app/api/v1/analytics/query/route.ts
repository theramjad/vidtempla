import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  getChannelTokens,
  logRequest,
} from "@/lib/api-auth";
import axios from "axios";

const YOUTUBE_ANALYTICS_API =
  "https://youtubeanalytics.googleapis.com/v2/reports";

/**
 * POST /api/v1/analytics/query
 * Raw pass-through to YouTube Analytics API
 * Body: { channelId, startDate, endDate, metrics, dimensions?, filters?, sort?, maxResults? }
 * Quota cost: counted separately (Analytics API has its own quota pool)
 */
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
    await logRequest(auth, "/analytics/query", "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "INVALID_BODY",
        "Request body must be valid JSON",
        "Send a JSON body with { channelId, startDate, endDate, metrics, dimensions?, filters?, sort?, maxResults? }",
        400
      ),
      { status: 400 }
    );
  }

  const { channelId, startDate, endDate, metrics, dimensions, filters, sort, maxResults } =
    body;

  if (!channelId || !startDate || !endDate || !metrics) {
    await logRequest(auth, "/analytics/query", "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "MISSING_PARAMETER",
        "channelId, startDate, endDate, and metrics are required",
        "Provide all required fields. Example metrics: views,estimatedMinutesWatched,averageViewDuration. Dates in YYYY-MM-DD format.",
        400
      ),
      { status: 400 }
    );
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    await logRequest(auth, "/analytics/query", "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "INVALID_PARAMETER",
        "startDate and endDate must be in YYYY-MM-DD format",
        "Use ISO date format, e.g. 2024-01-01",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, auth.userId);
  if ("error" in tokens) {
    await logRequest(auth, "/analytics/query", "POST", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const queryParams: Record<string, string | number> = {
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics,
    };
    if (dimensions) queryParams.dimensions = dimensions;
    if (filters) queryParams.filters = filters;
    if (sort) queryParams.sort = sort;
    if (maxResults) queryParams.maxResults = maxResults;

    const response = await axios.get(YOUTUBE_ANALYTICS_API, {
      params: queryParams,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(auth, "/analytics/query", "POST", 1, 200);
    return NextResponse.json(apiSuccess(response.data, {
      quotaUnits: 1,
      note: "Analytics API has its own quota pool separate from Data API",
    }));
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";

    // Check for scope-related errors
    if (status === 403 && message.includes("insufficient")) {
      await logRequest(auth, "/analytics/query", "POST", 0, 403);
      return NextResponse.json(
        apiError(
          "MISSING_SCOPE",
          "Analytics scope not authorized for this channel",
          "Reconnect your channel from the dashboard to enable analytics (requires yt-analytics.readonly scope)",
          403
        ),
        { status: 403 }
      );
    }

    await logRequest(auth, "/analytics/query", "POST", 1, status);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Check your query parameters. Valid metrics include: views, estimatedMinutesWatched, averageViewDuration, likes, dislikes, comments, shares, subscribersGained, subscribersLost. Valid dimensions include: day, month, country, video, ageGroup, gender.",
        status
      ),
      { status }
    );
  }
}
