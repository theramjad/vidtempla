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
} from '@/lib/clients/youtube';
import type { Database } from '@shared-types/database.types';
import { checkVideoLimit } from '@/lib/plan-limits';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const syncChannelVideos = inngestClient.createFunction(
  {
    id: 'youtube-sync-channel-videos',
    name: 'Sync YouTube Channel Videos',
  },
  { event: 'youtube/channel.sync' },
  async ({ event, step }) => {
    const { channelId, userId } = event.data;

    // Initialize Supabase client with service role
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

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

    // Step 4: Fetch all videos from YouTube (handle pagination)
    const allVideos = await step.run('fetch-youtube-videos', async () => {
      const videos: any[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const response = await fetchChannelVideos(
          channel.channel_id,
          accessToken,
          pageToken
        );

        videos.push(...response.videos);
        pageToken = response.nextPageToken;
      } while (pageToken);

      return videos;
    });

    // Step 5: Sync videos to database
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

      // Track new videos added and skipped due to limits
      let newVideosAdded = 0;
      let videosSkippedDueToLimit = 0;

      // Process each video
      for (const ytVideo of allVideos) {
        const videoId = ytVideo.id;
        const isNewVideo = !existingVideoIds.has(videoId);

        if (isNewVideo) {
          // Check video limit before adding new video
          const limitCheck = await checkVideoLimit(userId, supabase);

          if (!limitCheck.canAddVideo) {
            // User has reached their video limit, skip this video
            videosSkippedDueToLimit++;
            console.warn(
              `Skipping video ${videoId} for user ${userId}: Video limit reached (${limitCheck.currentCount}/${limitCheck.limit} on ${limitCheck.planTier} plan)`
            );
            continue;
          }

          // Insert new video
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

      // Step 6: Detect and delete videos that no longer exist on YouTube
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
        skippedDueToLimit: videosSkippedDueToLimit,
      };
    });

    // Step 7: Update last_synced_at timestamp
    await step.run('update-sync-timestamp', async () => {
      await supabase
        .from('youtube_channels')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', channelId);
    });

    return {
      success: true,
      channelId,
      videosProcessed: allVideos.length,
    };
  }
);
