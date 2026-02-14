/**
 * Inngest Function: Update Video Descriptions
 * Builds descriptions from templates and updates YouTube
 */

import { inngestClient } from '@/lib/clients/inngest';
import { NonRetriableError } from 'inngest';
import { db } from '@/db';
import { youtubeChannels, youtubeVideos, templates, descriptionHistory } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { decrypt, encrypt } from '@/utils/encryption';
import { refreshAccessToken, updateVideoDescription } from '@/lib/clients/youtube';
import { buildDescription } from '@/utils/templateParser';

// Helper to get valid access token
async function getValidAccessToken(
  channel: {
    id: string;
    channelId: string | null;
    title?: string | null;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
  }
): Promise<string> {
  if (!channel.accessTokenEncrypted || !channel.refreshTokenEncrypted) {
    throw new Error('Channel tokens not found');
  }

  const accessToken = decrypt(channel.accessTokenEncrypted);
  const expiresAt = channel.tokenExpiresAt;
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
    const refreshToken = decrypt(channel.refreshTokenEncrypted);

    try {
      const newTokens = await refreshAccessToken(refreshToken);

      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokens.expires_in);

      await db
        .update(youtubeChannels)
        .set({
          accessTokenEncrypted: encrypt(newTokens.access_token),
          tokenExpiresAt: newExpiresAt,
        })
        .where(eq(youtubeChannels.id, channel.id));

      return newTokens.access_token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if this is a token/auth error - mark as invalid immediately
      const isTokenError =
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked') ||
        errorMessage.includes('status 400');

      if (isTokenError) {
        // Mark channel as needing re-authentication immediately
        await db
          .update(youtubeChannels)
          .set({ tokenStatus: 'invalid' })
          .where(eq(youtubeChannels.id, channel.id));

        // Throw non-retryable error
        throw new NonRetriableError(
          `Token invalid for channel ${channel.channelId || 'unknown'} (${channel.title || 'Unknown'}). ` +
          `Please re-authenticate. Error: ${errorMessage}`
        );
      }

      // For other errors, throw normally (will retry)
      throw new Error(
        `Failed to refresh access token for channel ${channel.channelId || 'unknown'} (DB ID: ${channel.id}). ` +
        `Channel: ${channel.title || 'Unknown'}. ` +
        `Error: ${errorMessage}`
      );
    }
  }

  return accessToken;
}

export const updateVideoDescriptions = inngestClient.createFunction(
  {
    id: 'youtube-update-video-descriptions',
    name: 'Update YouTube Video Descriptions',
    concurrency: {
      limit: 5, // Process up to 5 videos concurrently
    },
  },
  {
    event: 'youtube/videos.update',
  },
  async ({ event, step }) => {
    const { videoIds, userId } = event.data;

    // Step 1: Fetch videos with their containers, templates, and variables
    const videosToUpdate = await step.run('fetch-videos-data', async () => {
      const videos = await db.query.youtubeVideos.findMany({
        where: inArray(youtubeVideos.id, videoIds),
        with: {
          youtubeChannel: true,
          container: true,
          videoVariables: true,
        },
      });

      return videos || [];
    });

    // Step 2: Build descriptions for each video
    const descriptionsToUpdate = await step.run(
      'build-descriptions',
      async () => {
        const results = [];

        for (const video of videosToUpdate) {
          // Skip videos without containers
          if (!video.container || !video.container.templateOrder) {
            continue;
          }

          // Fetch templates in order
          const templatesList = await db
            .select()
            .from(templates)
            .where(inArray(templates.id, video.container.templateOrder));

          if (!templatesList || templatesList.length === 0) {
            continue;
          }

          // Order templates according to template_order array
          const orderedTemplates = video.container.templateOrder
            .map((templateId) =>
              templatesList.find((t) => t.id === templateId)
            )
            .filter((t): t is NonNullable<typeof t> => t !== undefined);

          // Build variables map
          const variablesMap: Record<string, string> = {};
          if (video.videoVariables) {
            video.videoVariables.forEach((v: { variableName: string; variableValue: string | null }) => {
              variablesMap[v.variableName] = v.variableValue || '';
            });
          }

          // Build description with container's separator
          const newDescription = buildDescription(
            orderedTemplates,
            variablesMap,
            video.container.separator,
            video.videoId // Pass YouTube video ID for default variables
          );

          // Only update if description changed
          if (newDescription !== video.currentDescription) {
            results.push({
              videoId: video.id,
              videoIdYouTube: video.videoId,
              channelId: video.channelId,
              newDescription,
              channel: video.youtubeChannel,
            });
          }
        }

        return results;
      }
    );

    // Step 3: Update YouTube in batches (respect API rate limits)
    const BATCH_SIZE = 10;
    const updateResults: Array<{
      videoId: string;
      success: boolean;
      description?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < descriptionsToUpdate.length; i += BATCH_SIZE) {
      const batch = descriptionsToUpdate.slice(i, i + BATCH_SIZE);

      const batchResults = await step.run(
        `update-youtube-batch-${i / BATCH_SIZE}`,
        async () => {
          const results = [];

          for (const item of batch) {
            try {
              // Get valid access token for this channel
              const accessToken = await getValidAccessToken(item.channel);

              // Update YouTube
              await updateVideoDescription(
                item.videoIdYouTube,
                item.newDescription,
                accessToken
              );

              results.push({
                videoId: item.videoId,
                success: true,
                description: item.newDescription,
              });
            } catch (error) {
              console.error(
                `Failed to update video ${item.videoId}:`,
                error
              );
              results.push({
                videoId: item.videoId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          return results;
        }
      );

      updateResults.push(...batchResults);
    }

    // Step 4: Update database for successful updates
    await step.run('update-database', async () => {
      const successfulUpdates = updateResults.filter((r) => r.success && r.description);

      for (const update of successfulUpdates) {
        // TypeScript now knows description exists due to filter
        const description = update.description!;

        // Get current version number
        const historyData = await db
          .select({ versionNumber: descriptionHistory.versionNumber })
          .from(descriptionHistory)
          .where(eq(descriptionHistory.videoId, update.videoId))
          .orderBy(desc(descriptionHistory.versionNumber))
          .limit(1);

        const nextVersion = (historyData[0]?.versionNumber || 0) + 1;

        // Update current_description
        await db
          .update(youtubeVideos)
          .set({ currentDescription: description })
          .where(eq(youtubeVideos.id, update.videoId));

        // Create history entry
        await db.insert(descriptionHistory).values({
          videoId: update.videoId,
          description: description,
          versionNumber: nextVersion,
          createdBy: userId,
        });
      }

      return {
        successful: successfulUpdates.length,
        failed: updateResults.filter((r) => !r.success).length,
      };
    });

    return {
      success: true,
      videosProcessed: videoIds.length,
      videosUpdated: updateResults.filter((r) => r.success).length,
      videosFailed: updateResults.filter((r) => !r.success).length,
    };
  }
);
