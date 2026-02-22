import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  logRequest,
  getChannelTokens,
} from "@/lib/api-auth";
import { fetchChannelAnalytics } from "@/lib/clients/youtube";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { channelId } = await params;

  try {
    const url = new URL(request.url);
    const now = new Date();
    const twentyEightDaysAgo = new Date(
      now.getTime() - 28 * 24 * 60 * 60 * 1000
    );

    const startDate =
      url.searchParams.get("startDate") ??
      twentyEightDaysAgo.toISOString().split("T")[0]!;
    const endDate =
      url.searchParams.get("endDate") ?? now.toISOString().split("T")[0]!;
    const metrics =
      url.searchParams.get("metrics") ?? "views,estimatedMinutesWatched";
    const dimensions = url.searchParams.get("dimensions") ?? "day";

    const tokens = await getChannelTokens(channelId, auth.userId);
    if ("error" in tokens) {
      logRequest(
        auth,
        `/v1/channels/${channelId}/analytics`,
        "GET",
        tokens.status,
        0
      );
      return NextResponse.json(tokens.error, { status: tokens.status });
    }

    const data = await fetchChannelAnalytics(
      tokens.accessToken,
      tokens.channelId,
      metrics,
      dimensions,
      startDate,
      endDate
    );

    logRequest(auth, `/v1/channels/${channelId}/analytics`, "GET", 200, 0);
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    logRequest(auth, `/v1/channels/${channelId}/analytics`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "ANALYTICS_ERROR",
        "Failed to fetch channel analytics",
        "Ensure your channel has analytics access. You may need to reconnect your channel from the dashboard.",
        500
      ),
      { status: 500 }
    );
  }
}
