/**
 * Inngest Function: Scheduled Sync
 * Runs every 6 hours to sync all YouTube channels
 */

import { inngestClient } from '@/lib/clients/inngest';
import { db } from '@/db';
import { youtubeChannels } from '@/db/schema';

export const scheduledSync = inngestClient.createFunction(
  {
    id: 'youtube-scheduled-sync',
    name: 'Scheduled YouTube Channel Sync',
  },
  { cron: '0 */6 * * *' }, // Run every 6 hours
  async ({ step }) => {
    // Step 1: Fetch all YouTube channels
    const channels = await step.run('fetch-all-channels', async () => {
      const data = await db
        .select({ id: youtubeChannels.id, userId: youtubeChannels.userId })
        .from(youtubeChannels);

      return data || [];
    });

    // Step 2: Trigger sync event for each channel
    await step.run('trigger-channel-syncs', async () => {
      for (const channel of channels) {
        await inngestClient.send({
          name: 'youtube/channel.sync',
          data: {
            channelId: channel.id,
            userId: channel.userId,
          },
        });
      }

      return { channelsQueued: channels.length };
    });

    return {
      success: true,
      channelsQueued: channels.length,
      timestamp: new Date().toISOString(),
    };
  }
);
