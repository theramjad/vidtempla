/**
 * Inngest Function: Update Video Descriptions
 * Builds descriptions from templates and updates YouTube
 */

import { inngestClient } from '@/lib/clients/inngest';
import { createClient } from '@supabase/supabase-js';
import { decrypt, encrypt } from '@/utils/encryption';
import { refreshAccessToken, updateVideoDescription } from '@/lib/clients/youtube';
import { buildDescription } from '@/utils/templateParser';
import type { Database } from '@shared-types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get valid access token
async function getValidAccessToken(
  channel: any,
  supabase: any
): Promise<string> {
  if (!channel.access_token_encrypted || !channel.refresh_token_encrypted) {
    throw new Error('Channel tokens not found');
  }

  const accessToken = decrypt(channel.access_token_encrypted);
  const expiresAt = channel.token_expires_at
    ? new Date(channel.token_expires_at)
    : null;
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
    const refreshToken = decrypt(channel.refresh_token_encrypted);
    const newTokens = await refreshAccessToken(refreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokens.expires_in);

    await supabase
      .from('youtube_channels')
      .update({
        access_token_encrypted: encrypt(newTokens.access_token),
        token_expires_at: newExpiresAt.toISOString(),
      })
      .eq('id', channel.id);

    return newTokens.access_token;
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

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch videos with their containers, templates, and variables
    const videosToUpdate = await step.run('fetch-videos-data', async () => {
      const { data: videos, error } = await supabase
        .from('youtube_videos')
        .select(
          `
          *,
          channel:youtube_channels!youtube_videos_channel_id_fkey(*),
          container:containers(
            id,
            name,
            template_order,
            separator
          ),
          variables:video_variables(*)
        `
        )
        .in('id', videoIds);

      if (error) {
        throw new Error(`Failed to fetch videos: ${error.message}`);
      }

      return videos || [];
    });

    // Step 2: Build descriptions for each video
    const descriptionsToUpdate = await step.run(
      'build-descriptions',
      async () => {
        const results = [];

        for (const video of videosToUpdate) {
          // Skip videos without containers
          if (!video.container || !video.container.template_order) {
            continue;
          }

          // Fetch templates in order
          const { data: templates } = await supabase
            .from('templates')
            .select('*')
            .in('id', video.container.template_order);

          if (!templates || templates.length === 0) {
            continue;
          }

          // Order templates according to template_order array
          const orderedTemplates = video.container.template_order
            .map((templateId) =>
              templates.find((t) => t.id === templateId)
            )
            .filter((t): t is NonNullable<typeof t> => t !== undefined);

          // Build variables map
          const variablesMap: Record<string, string> = {};
          if (video.variables) {
            video.variables.forEach((v: any) => {
              variablesMap[v.variable_name] = v.variable_value || '';
            });
          }

          // Build description with container's separator
          const newDescription = buildDescription(
            orderedTemplates,
            variablesMap,
            video.container.separator
          );

          // Only update if description changed
          if (newDescription !== video.current_description) {
            results.push({
              videoId: video.id,
              videoIdYouTube: video.video_id,
              channelId: video.channel_id,
              newDescription,
              channel: video.channel,
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
              const accessToken = await getValidAccessToken(
                item.channel,
                supabase
              );

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
        const { data: historyData } = await supabase
          .from('description_history')
          .select('version_number')
          .eq('video_id', update.videoId)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        const nextVersion = (historyData?.version_number || 0) + 1;

        // Update current_description
        await supabase
          .from('youtube_videos')
          .update({ current_description: description })
          .eq('id', update.videoId);

        // Create history entry
        await supabase.from('description_history').insert({
          video_id: update.videoId,
          description: description,
          version_number: nextVersion,
          created_by: userId,
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
