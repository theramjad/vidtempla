import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { inngestClient } from "@/lib/clients/inngest";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { channelId } = await params;

  try {
    // Look up internal channel by YouTube channelId
    const [channel] = await db
      .select({ id: youtubeChannels.id, syncStatus: youtubeChannels.syncStatus })
      .from(youtubeChannels)
      .where(
        and(
          eq(youtubeChannels.channelId, channelId),
          eq(youtubeChannels.userId, auth.userId)
        )
      );

    if (!channel) {
      logRequest(auth, `/v1/channels/${channelId}/sync`, "POST", 404, 0);
      return NextResponse.json(
        apiError(
          "CHANNEL_NOT_FOUND",
          "Channel not found or not connected",
          "Connect a YouTube channel from the dashboard first",
          404
        ),
        { status: 404 }
      );
    }

    if (channel.syncStatus === "syncing") {
      logRequest(auth, `/v1/channels/${channelId}/sync`, "POST", 409, 0);
      return NextResponse.json(
        apiError(
          "SYNC_IN_PROGRESS",
          "A sync is already in progress for this channel",
          "Wait for the current sync to complete before starting another",
          409
        ),
        { status: 409 }
      );
    }

    await inngestClient.send({
      name: "youtube/channel.sync",
      data: {
        channelId: channel.id,
        userId: auth.userId,
      },
    });

    logRequest(auth, `/v1/channels/${channelId}/sync`, "POST", 202, 0);
    return NextResponse.json(
      apiSuccess({
        message: "Video sync started",
        jobId: `sync-${channel.id}-${Date.now()}`,
      }),
      { status: 202 }
    );
  } catch (error) {
    logRequest(auth, `/v1/channels/${channelId}/sync`, "POST", 500, 0);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to trigger sync", "Try again later", 500),
      { status: 500 }
    );
  }
}
