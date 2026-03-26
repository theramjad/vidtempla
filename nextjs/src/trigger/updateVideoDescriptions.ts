import { task, AbortTaskRunError, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import {
  youtubeChannels,
  youtubeVideos,
  templates,
  descriptionHistory,
} from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { decrypt, encrypt } from "@/utils/encryption";
import {
  refreshAccessToken,
  updateVideoDescription,
} from "@/lib/clients/youtube";
import { buildDescription } from "@/utils/templateParser";

interface ChannelData {
  id: string;
  channelId: string | null;
  title: string | null;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  tokenStatus: string;
}

interface DescriptionToUpdate {
  videoId: string;
  videoIdYouTube: string;
  channelId: string;
  newDescription: string;
  channel: ChannelData;
}

async function getValidAccessToken(channel: ChannelData): Promise<string> {
  if (!channel.accessTokenEncrypted || !channel.refreshTokenEncrypted) {
    throw new Error("Channel tokens not found");
  }

  const accessToken = decrypt(channel.accessTokenEncrypted);
  const expiresAt = channel.tokenExpiresAt
    ? new Date(channel.tokenExpiresAt)
    : null;
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

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
        .where(eq(youtubeChannels.id, channel.id));

      return newTokens.access_token;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const isTokenError =
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("Token has been expired or revoked") ||
        errorMessage.includes("status 400");

      if (isTokenError) {
        await db
          .update(youtubeChannels)
          .set({ tokenStatus: "invalid" })
          .where(eq(youtubeChannels.id, channel.id));

        throw new AbortTaskRunError(
          `Token invalid for channel ${channel.channelId || "unknown"} (${channel.title || "Unknown"}). ` +
            `Please re-authenticate. Error: ${errorMessage}`
        );
      }

      throw new Error(
        `Failed to refresh access token for channel ${channel.channelId || "unknown"} (DB ID: ${channel.id}). ` +
          `Channel: ${channel.title || "Unknown"}. ` +
          `Error: ${errorMessage}`
      );
    }
  }

  return accessToken;
}

export const updateVideoDescriptions = task({
  id: "youtube-update-video-descriptions",
  queue: {
    concurrencyLimit: 5,
  },
  run: async (payload: { videoIds: string[]; userId: string }) => {
    const { videoIds, userId } = payload;

    // Fetch videos with their containers, templates, and variables
    const videosToUpdate = await db.query.youtubeVideos.findMany({
      where: inArray(youtubeVideos.id, videoIds),
      with: {
        youtubeChannel: true,
        container: true,
        videoVariables: true,
      },
    });

    // Build descriptions for each video
    const descriptionsToUpdate: DescriptionToUpdate[] = [];

    for (const video of videosToUpdate) {
      if (!video.container || !video.container.templateOrder) {
        continue;
      }

      const templatesList = await db
        .select()
        .from(templates)
        .where(inArray(templates.id, video.container.templateOrder));

      if (!templatesList || templatesList.length === 0) {
        continue;
      }

      const orderedTemplates = video.container.templateOrder
        .map((templateId) => templatesList.find((t) => t.id === templateId))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);

      const variablesMap: Record<string, string> = {};
      if (video.videoVariables) {
        video.videoVariables.forEach((v) => {
          variablesMap[v.variableName] = v.variableValue || "";
        });
      }

      const newDescription = buildDescription(
        orderedTemplates,
        variablesMap,
        video.container.separator,
        video.videoId
      );

      if (newDescription !== video.currentDescription) {
        descriptionsToUpdate.push({
          videoId: video.id,
          videoIdYouTube: video.videoId,
          channelId: video.channelId,
          newDescription,
          channel: video.youtubeChannel,
        });
      }
    }

    // Update YouTube in batches
    const BATCH_SIZE = 10;
    const updateResults: Array<{
      videoId: string;
      success: boolean;
      description?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < descriptionsToUpdate.length; i += BATCH_SIZE) {
      const batch = descriptionsToUpdate.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
        try {
          const accessToken = await getValidAccessToken(item.channel);

          await updateVideoDescription(
            item.videoIdYouTube,
            item.newDescription,
            accessToken
          );

          updateResults.push({
            videoId: item.videoId,
            success: true,
            description: item.newDescription,
          });
        } catch (error) {
          logger.error(`Failed to update video ${item.videoId}`, { error });
          updateResults.push({
            videoId: item.videoId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    // Update database for successful updates
    const successfulUpdates = updateResults.filter(
      (r) => r.success && r.description
    );

    for (const update of successfulUpdates) {
      const description = update.description!;

      const historyData = await db
        .select({ versionNumber: descriptionHistory.versionNumber })
        .from(descriptionHistory)
        .where(eq(descriptionHistory.videoId, update.videoId))
        .orderBy(desc(descriptionHistory.versionNumber))
        .limit(1);

      const nextVersion = (historyData[0]?.versionNumber || 0) + 1;

      await db
        .update(youtubeVideos)
        .set({ currentDescription: description })
        .where(eq(youtubeVideos.id, update.videoId));

      await db.insert(descriptionHistory).values({
        videoId: update.videoId,
        description: description,
        versionNumber: nextVersion,
        createdBy: userId,
      });
    }

    return {
      success: true,
      videosProcessed: videoIds.length,
      videosUpdated: updateResults.filter((r) => r.success).length,
      videosFailed: updateResults.filter((r) => !r.success).length,
    };
  },
});
