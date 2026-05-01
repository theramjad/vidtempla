import { FatalError } from "workflow";
import { db } from "@/db";
import {
  youtubeChannels,
  youtubeVideos,
  descriptionHistory,
} from "@/db/schema";
import { eq, and, inArray, lt, ne, or, sql } from "drizzle-orm";
import { decrypt, encrypt } from "@/utils/encryption";
import {
  isYouTubeInvalidGrantError,
  refreshAccessToken,
  fetchChannelVideos,
  fetchChannelInfo,
  getUploadsPlaylistId,
} from "@/lib/clients/youtube";
import { detectAndRecordDrift } from "@/lib/services/drift";

const SYNC_LOCK_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export async function syncChannelVideosWorkflow(
  channelId: string,
  userId: string,
  organizationId?: string
) {
  "use workflow";

  return await runSyncChannelVideos(channelId, userId, organizationId);
}

async function markSyncFailed(
  channelId: string,
  userId: string,
  err: unknown,
  organizationId?: string
) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error("[sync-channel-videos] failed", { channelId, error: errorMessage });

  const isTokenError =
    isYouTubeInvalidGrantError(err) ||
    errorMessage.includes("invalid_grant") ||
    errorMessage.includes("Token has been expired or revoked") ||
    errorMessage.includes("Failed to refresh access token");

  const ownerFilter = organizationId
    ? eq(youtubeChannels.organizationId, organizationId)
    : eq(youtubeChannels.userId, userId);

  await db
    .update(youtubeChannels)
    .set({
      syncStatus: "idle",
      ...(isTokenError && { tokenStatus: "invalid" }),
    })
    .where(
      and(
        eq(youtubeChannels.id, channelId),
        ownerFilter,
        eq(youtubeChannels.syncStatus, "syncing")
      )
    );
}

async function runSyncChannelVideos(
  channelId: string,
  userId: string,
  organizationId?: string
) {
  "use step";

  const staleSyncCutoff = new Date(
    Date.now() - SYNC_LOCK_STALE_AFTER_MS
  );
  const ownerFilter = organizationId
    ? eq(youtubeChannels.organizationId, organizationId)
    : eq(youtubeChannels.userId, userId);

  // Atomic compare-and-set: claim the channel only if it's not already syncing.
  // Prevents two overlapping runs (cron retry, deploy-time double-fire, or
  // cron + manual trigger) from both proceeding and double-inserting drift /
  // history rows and burning YouTube quota twice. updatedAt is trigger-managed,
  // so it is safe as a stale-age signal but not as a lock token.
  const claimed = await db
    .update(youtubeChannels)
    .set({ syncStatus: "syncing" })
    .where(
      and(
        eq(youtubeChannels.id, channelId),
        ownerFilter,
        or(
          ne(youtubeChannels.syncStatus, "syncing"),
          lt(youtubeChannels.updatedAt, staleSyncCutoff)
        )
      )
    )
    .returning({ id: youtubeChannels.id });

  if (claimed.length === 0) {
    const [channel] = await db
      .select({ id: youtubeChannels.id })
      .from(youtubeChannels)
      .where(
        and(
          eq(youtubeChannels.id, channelId),
          ownerFilter
        )
      );

    if (!channel) {
      throw new Error("Channel not found");
    }

    console.log(
      `[sync-channel-videos] Sync already in progress for channel ${channelId}, skipping`
    );
    return {
      success: true,
      skipped: true,
      channelId,
      videosProcessed: 0,
      newVideos: 0,
      deletedVideos: 0,
    };
  }

  try {
    return await syncClaimedChannelVideos(channelId, userId, ownerFilter);
  } catch (err) {
    await markSyncFailed(channelId, userId, err, organizationId);
    throw err;
  }
}

async function syncClaimedChannelVideos(
  channelId: string,
  userId: string,
  ownerFilter: ReturnType<typeof eq>
) {
  const [channel] = await db
    .select()
    .from(youtubeChannels)
    .where(
      and(
        eq(youtubeChannels.id, channelId),
        ownerFilter
      )
    );

  if (!channel) {
    throw new Error("Channel not found");
  }

  let accessToken: string;
  if (!channel.accessTokenEncrypted || !channel.refreshTokenEncrypted) {
    throw new Error("Channel tokens not found");
  }

  const currentAccessToken = decrypt(channel.accessTokenEncrypted);
  const expiresAt = channel.tokenExpiresAt
    ? new Date(channel.tokenExpiresAt)
    : null;
  const now = new Date();
  const bufferTime = 5 * 60 * 1000;

  if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
    const refreshToken = decrypt(channel.refreshTokenEncrypted);

    try {
      const newTokens = await refreshAccessToken(refreshToken);

      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(
        newExpiresAt.getSeconds() + newTokens.expires_in
      );

      await db
        .update(youtubeChannels)
        .set({
          accessTokenEncrypted: encrypt(newTokens.access_token),
          tokenExpiresAt: newExpiresAt,
        })
        .where(eq(youtubeChannels.id, channelId));

      accessToken = newTokens.access_token;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const isTokenError =
        isYouTubeInvalidGrantError(error) ||
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("Token has been expired or revoked") ||
        errorMessage.includes("status 400");

      if (isTokenError) {
        await db
          .update(youtubeChannels)
          .set({
            tokenStatus: "invalid",
            syncStatus: "idle",
          })
          .where(
            and(
              eq(youtubeChannels.id, channelId),
              ownerFilter,
              eq(youtubeChannels.syncStatus, "syncing")
            )
          );

        throw new FatalError(
          `Token invalid for channel ${channel.channelId} (${channel.title || "Unknown"}). ` +
            `Please re-authenticate. Error: ${errorMessage}`
        );
      }

      throw new Error(
        `Failed to refresh access token for channel ${channel.channelId} (DB ID: ${channelId}). ` +
          `Channel: ${channel.title || "Unknown"}. ` +
          `Error: ${errorMessage}`
      );
    }
  } else {
    accessToken = currentAccessToken;
  }

  try {
    const channelInfo = await fetchChannelInfo(accessToken);

    await db
      .update(youtubeChannels)
      .set({
        title: channelInfo.snippet.title,
        thumbnailUrl: channelInfo.snippet.thumbnails.default.url,
        subscriberCount: parseInt(
          channelInfo.statistics.subscriberCount || "0",
          10
        ),
      })
      .where(eq(youtubeChannels.id, channelId));
  } catch (error) {
    console.error("[sync-channel-videos] failed to update channel info", { error });
  }

  const uploadsPlaylistId = await getUploadsPlaylistId(
    channel.channelId,
    accessToken
  );

  const allVideos: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
    };
  }> = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await fetchChannelVideos(
      channel.channelId,
      accessToken,
      pageToken,
      uploadsPlaylistId
    );

    allVideos.push(...response.videos);
    pageToken = response.nextPageToken;
  } while (pageToken);

  const videoIds = allVideos.map((v) => v.id);
  const isBaseline = channel.driftBaselinedAt === null;

  const existingVideos = await db
    .select({
      id: youtubeVideos.id,
      videoId: youtubeVideos.videoId,
    })
    .from(youtubeVideos)
    .where(eq(youtubeVideos.channelId, channelId));

  const existingVideoMap = new Map(existingVideos.map((v) => [v.videoId, v]));

  let newVideosAdded = 0;

  for (const ytVideo of allVideos) {
    const videoId = ytVideo.id;
    const existingVideo = existingVideoMap.get(videoId);

    if (!existingVideo) {
      const [insertedVideo] = await db
        .insert(youtubeVideos)
        .values({
          channelId: channelId,
          videoId: videoId,
          title: ytVideo.snippet.title,
          currentDescription: ytVideo.snippet.description,
          publishedAt: new Date(ytVideo.snippet.publishedAt),
        })
        .returning();

      if (insertedVideo) {
        newVideosAdded++;
        await db.insert(descriptionHistory).values({
          videoId: insertedVideo.id,
          description: ytVideo.snippet.description || "",
          versionNumber: 1,
          renderSnapshot: null,
          createdBy: userId,
          source: "initial_sync",
        });
      }
      continue;
    }

    await db
      .update(youtubeVideos)
      .set({
        title: ytVideo.snippet.title,
        publishedAt: new Date(ytVideo.snippet.publishedAt),
        updatedAt: new Date(),
      })
      .where(eq(youtubeVideos.id, existingVideo.id));

    if (isBaseline) {
      await db
        .update(youtubeVideos)
        .set({ currentDescription: ytVideo.snippet.description, updatedAt: new Date() })
        .where(eq(youtubeVideos.id, existingVideo.id));
    } else {
      await db.transaction(async (tx) => {
        await detectAndRecordDrift(existingVideo.id, ytVideo.snippet.description, userId, tx);
      });
    }
  }

  const videosToDelete = Array.from(existingVideoMap.keys()).filter(
    (id) => !videoIds.includes(id)
  );

  if (videosToDelete.length > 0) {
    await db
      .delete(youtubeVideos)
      .where(
        and(
          inArray(youtubeVideos.videoId, videosToDelete),
          eq(youtubeVideos.channelId, channelId)
        )
      );
  }

  if (isBaseline) {
    await db
      .update(youtubeChannels)
      .set({ driftBaselinedAt: new Date() })
      .where(
        and(
          eq(youtubeChannels.id, channelId),
          sql`${youtubeChannels.driftBaselinedAt} IS NULL`
        )
      );
  }

  await db
    .update(youtubeChannels)
    .set({
      lastSyncedAt: new Date(),
      syncStatus: "idle",
    })
    .where(
      and(
        eq(youtubeChannels.id, channelId),
        ownerFilter,
        eq(youtubeChannels.syncStatus, "syncing")
      )
    );

  return {
    success: true,
    channelId,
    videosProcessed: allVideos.length,
    newVideos: newVideosAdded,
    deletedVideos: videosToDelete.length,
  };
}
