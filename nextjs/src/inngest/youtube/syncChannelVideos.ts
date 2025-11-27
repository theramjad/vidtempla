/**
 * Inngest Function: Sync Channel Videos
 * Fetches all videos from YouTube and syncs them to the database
 */

import { inngestClient } from '@/lib/clients/inngest';
import { createClient } from '@supabase/supabase-js';
import { decrypt, encrypt } from '@/utils/encryption';
import {
  refreshAccessToken,
  fetchChannelVideos,
  fetchChannelInfo,
  getUploadsPlaylistId,
} from '@/lib/clients/youtube';
import type { Database } from '@shared-types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
      const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('youtube_channels')
        .update({
          sync_status: 'idle',
          ...(isTokenError && { token_status: 'invalid' }),
        })
        .eq('id', channelId);
    },
  },
  { event: 'youtube/channel.sync' },
  async ({ event, step }) => {
    const { channelId, userId } = event.data;

    // Initialize Supabase client with service role
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Step 0: Set sync status to 'syncing'
    await step.run('set-syncing-status', async () => {
      await supabase
        .from('youtube_channels')
        .update({ sync_status: 'syncing' })
        .eq('id', channelId);
    });

    // Step 1: Fetch channel from database and decrypt tokens
    const channel = await step.run('fetch-channel', async () => {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('id', channelId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        throw new Error(`Channel not found: ${error?.message || 'Unknown error'}`);
      }

      return data;
    });

    // Step 2: Get valid access token (refresh if needed)
    const accessToken = await step.run('get-access-token', async () => {
      if (!channel.access_token_encrypted || !channel.refresh_token_encrypted) {
        throw new Error('Channel tokens not found');
      }

      const currentAccessToken = decrypt(channel.access_token_encrypted);
      const expiresAt = channel.token_expires_at ? new Date(channel.token_expires_at) : null;
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes

      // Check if token is expired or about to expire
      if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
        const refreshToken = decrypt(channel.refresh_token_encrypted);

        try {
          const newTokens = await refreshAccessToken(refreshToken);

          // Update tokens in database
          const newExpiresAt = new Date();
          newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokens.expires_in);

          await supabase
            .from('youtube_channels')
            .update({
              access_token_encrypted: encrypt(newTokens.access_token),
              token_expires_at: newExpiresAt.toISOString(),
            })
            .eq('id', channelId);

          return newTokens.access_token;
        } catch (error) {
          // Add context about which channel failed
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(
            `Failed to refresh access token for channel ${channel.channel_id} (DB ID: ${channelId}). ` +
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

        await supabase
          .from('youtube_channels')
          .update({
            title: channelInfo.snippet.title,
            thumbnail_url: channelInfo.snippet.thumbnails.default.url,
            subscriber_count: parseInt(channelInfo.statistics.subscriberCount || '0', 10),
          })
          .eq('id', channelId);
      } catch (error) {
        console.error('Failed to update channel info:', error);
        // Don't fail the entire job if this fails
      }
    });

    // Step 4: Get uploads playlist ID (needed for PlaylistItems API)
    const uploadsPlaylistId = await step.run('get-uploads-playlist', async () => {
      return await getUploadsPlaylistId(channel.channel_id, accessToken);
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
          channel.channel_id,
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
      const { data: existingVideos } = await supabase
        .from('youtube_videos')
        .select('video_id')
        .eq('channel_id', channelId);

      const existingVideoIds = new Set(
        existingVideos?.map((v) => v.video_id) || []
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
          const { data: insertedVideo, error: insertError } = await supabase
            .from('youtube_videos')
            .insert({
              channel_id: channelId,
              video_id: videoId,
              title: ytVideo.snippet.title,
              current_description: ytVideo.snippet.description,
              published_at: ytVideo.snippet.publishedAt,
            })
            .select()
            .single();

          if (!insertError && insertedVideo) {
            newVideosAdded++;
            // Create initial description history entry
            await supabase.from('description_history').insert({
              video_id: insertedVideo.id,
              description: ytVideo.snippet.description || '',
              version_number: 1,
              created_by: userId,
            });
          }
        } else {
          // Update existing video (title, published_at - don't change description)
          await supabase
            .from('youtube_videos')
            .update({
              title: ytVideo.snippet.title,
              published_at: ytVideo.snippet.publishedAt,
            })
            .eq('video_id', videoId)
            .eq('channel_id', channelId);
        }
      }

      // Detect and delete videos that no longer exist on YouTube
      const videosToDelete = Array.from(existingVideoIds).filter(
        (id) => !videoIds.includes(id)
      );

      if (videosToDelete.length > 0) {
        await supabase
          .from('youtube_videos')
          .delete()
          .in('video_id', videosToDelete)
          .eq('channel_id', channelId);
      }

      return {
        total: allVideos.length,
        new: newVideosAdded,
        deleted: videosToDelete.length,
      };
    });

    // Step 7: Update last_synced_at timestamp and set status to idle
    await step.run('update-sync-timestamp', async () => {
      await supabase
        .from('youtube_channels')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: 'idle'
        })
        .eq('id', channelId);
    });

    return {
      success: true,
      channelId,
      videosProcessed: allVideos.length,
    };
  }
);
