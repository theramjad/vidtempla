/**
 * Inngest Function: Sync Channel Videos
 * Fetches all videos from YouTube and syncs them to the database
 */

import { inngestClient } from '@/lib/clients/inngest';
import { NonRetriableError } from 'inngest';
import { db } from '@/db';
import { youtubeChannels, youtubeVideos, descriptionHistory } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { decrypt, encrypt } from '@/utils/encryption';
import {
  refreshAccessToken,
  fetchChannelVideos,
  fetchChannelInfo,
  getUploadsPlaylistId,
} from '@/lib/clients/youtube';

export const syncChannelVideos = inngestClient.createFunction(
  {
    id: 'youtube-sync-channel-videos',
    name: 'Sync YouTube Channel Videos',
    onFailure: async ({ event, error }) => {
      const { channelId } = event.data.event.data;
      const errorMessage = error?.message || String(error);

      console.error('Sync failed for channel:', channelId, 'Error:', error);

      // Check if this is a token/auth error
      const isTokenError =
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked') ||
        errorMessage.includes('Failed to refresh access token');

      // Reset sync status and mark token as invalid if it's a token error
      await db
        .update(youtubeChannels)
        .set({
          syncStatus: 'idle',
          ...(isTokenError && { tokenStatus: 'invalid' }),
        })
        .where(eq(youtubeChannels.id, channelId));
    },
  },
  { event: 'youtube/channel.sync' },
  async ({ event, step }) => {
    const { channelId, userId } = event.data;

    // Step 0: Set sync status to 'syncing'
    await step.run('set-syncing-status', async () => {
      await db
        .update(youtubeChannels)
        .set({ syncStatus: 'syncing' })
        .where(eq(youtubeChannels.id, channelId));
    });

    // Step 1: Fetch channel from database and decrypt tokens
    const channel = await step.run('fetch-channel', async () => {
      const [data] = await db
        .select()
        .from(youtubeChannels)
        .where(
          and(
            eq(youtubeChannels.id, channelId),
            eq(youtubeChannels.userId, userId)
          )
        );

      if (!data) {
        throw new Error(`Channel not found`);
      }

      return data;
    });

    // Step 2: Get valid access token (refresh if needed)
    const accessToken = await step.run('get-access-token', async () => {
      if (!channel.accessTokenEncrypted || !channel.refreshTokenEncrypted) {
        throw new Error('Channel tokens not found');
      }

      const currentAccessToken = decrypt(channel.accessTokenEncrypted);
      const expiresAt = channel.tokenExpiresAt ? new Date(channel.tokenExpiresAt) : null;
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes

      // Check if token is expired or about to expire
      if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
        const refreshToken = decrypt(channel.refreshTokenEncrypted);

        try {
          const newTokens = await refreshAccessToken(refreshToken);

          // Update tokens in database
          const newExpiresAt = new Date();
          newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokens.expires_in);

          await db
            .update(youtubeChannels)
            .set({
              accessTokenEncrypted: encrypt(newTokens.access_token),
              tokenExpiresAt: newExpiresAt,
            })
            .where(eq(youtubeChannels.id, channelId));

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
              .set({
                tokenStatus: 'invalid',
                syncStatus: 'idle',
              })
              .where(eq(youtubeChannels.id, channelId));

            // Throw non-retryable error
            throw new NonRetriableError(
              `Token invalid for channel ${channel.channelId} (${channel.title || 'Unknown'}). ` +
              `Please re-authenticate. Error: ${errorMessage}`
            );
          }

          // For other errors, throw normally (will retry)
          throw new Error(
            `Failed to refresh access token for channel ${channel.channelId} (DB ID: ${channelId}). ` +
            `Channel: ${channel.title || 'Unknown'}. ` +
            `Error: ${errorMessage}`
          );
        }
      }

      return currentAccessToken;
    });

    // Step 3: Update channel info (subscriber count, etc.)
    await step.run('update-channel-info', async () => {
      try {
        const channelInfo = await fetchChannelInfo(accessToken);

        await db
          .update(youtubeChannels)
          .set({
            title: channelInfo.snippet.title,
            thumbnailUrl: channelInfo.snippet.thumbnails.default.url,
            subscriberCount: parseInt(channelInfo.statistics.subscriberCount || '0', 10),
          })
          .where(eq(youtubeChannels.id, channelId));
      } catch (error) {
        console.error('Failed to update channel info:', error);
        // Don't fail the entire job if this fails
      }
    });

    // Step 4: Get uploads playlist ID (needed for PlaylistItems API)
    const uploadsPlaylistId = await step.run('get-uploads-playlist', async () => {
      return await getUploadsPlaylistId(channel.channelId, accessToken);
    });

    // Step 5: Fetch all videos from YouTube (handle pagination)
    const allVideos = await step.run('fetch-youtube-videos', async () => {
      const videos: Array<{
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

        videos.push(...response.videos);
        pageToken = response.nextPageToken;
      } while (pageToken);

      return videos;
    });

    // Step 6: Sync videos to database
    await step.run('sync-videos-to-db', async () => {
      const videoIds = allVideos.map((v) => v.id);

      // Get existing videos in database
      const existingVideos = await db
        .select({ videoId: youtubeVideos.videoId })
        .from(youtubeVideos)
        .where(eq(youtubeVideos.channelId, channelId));

      const existingVideoIds = new Set(
        existingVideos.map((v) => v.videoId)
      );

      // Track new videos added
      let newVideosAdded = 0;

      // Process each video - sync ALL videos regardless of plan limits
      // Plan limits are only enforced when assigning/updating video descriptions
      for (const ytVideo of allVideos) {
        const videoId = ytVideo.id;
        const isNewVideo = !existingVideoIds.has(videoId);

        if (isNewVideo) {
          // Insert new video without checking limits
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
            // Create initial description history entry
            await db.insert(descriptionHistory).values({
              videoId: insertedVideo.id,
              description: ytVideo.snippet.description || '',
              versionNumber: 1,
              createdBy: userId,
            });
          }
        } else {
          // Update existing video (title, published_at - don't change description)
          await db
            .update(youtubeVideos)
            .set({
              title: ytVideo.snippet.title,
              publishedAt: new Date(ytVideo.snippet.publishedAt),
            })
            .where(
              and(
                eq(youtubeVideos.videoId, videoId),
                eq(youtubeVideos.channelId, channelId)
              )
            );
        }
      }

      // Detect and delete videos that no longer exist on YouTube
      const videosToDelete = Array.from(existingVideoIds).filter(
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

      return {
        total: allVideos.length,
        new: newVideosAdded,
        deleted: videosToDelete.length,
      };
    });

    // Step 7: Update last_synced_at timestamp and set status to idle
    await step.run('update-sync-timestamp', async () => {
      await db
        .update(youtubeChannels)
        .set({
          lastSyncedAt: new Date(),
          syncStatus: 'idle'
        })
        .where(eq(youtubeChannels.id, channelId));
    });

    return {
      success: true,
      channelId,
      videosProcessed: allVideos.length,
    };
  }
);
