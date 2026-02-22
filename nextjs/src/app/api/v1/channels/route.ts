import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const channels = await db
      .select({
        id: youtubeChannels.id,
        channelId: youtubeChannels.channelId,
        title: youtubeChannels.title,
        thumbnailUrl: youtubeChannels.thumbnailUrl,
        subscriberCount: youtubeChannels.subscriberCount,
        syncStatus: youtubeChannels.syncStatus,
        lastSyncedAt: youtubeChannels.lastSyncedAt,
      })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.userId, auth.userId))
      .orderBy(desc(youtubeChannels.createdAt));

    logRequest(auth, "/v1/channels", "GET", 200, 0);
    return NextResponse.json(apiSuccess(channels));
  } catch (error) {
    logRequest(auth, "/v1/channels", "GET", 500, 0);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch channels", "Try again later", 500),
      { status: 500 }
    );
  }
}
