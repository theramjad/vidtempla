/**
 * Inngest Function: Scheduled Sync
 * Runs every 6 hours to sync all YouTube channels
 */

import { inngestClient } from '@/lib/clients/inngest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from 'shared-types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const scheduledSync = inngestClient.createFunction(
  {
    id: 'youtube-scheduled-sync',
    name: 'Scheduled YouTube Channel Sync',
  },
  { cron: '0 */6 * * *' }, // Run every 6 hours
  async ({ step }) => {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch all YouTube channels
    const channels = await step.run('fetch-all-channels', async () => {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('id, user_id');

      if (error) {
        throw new Error(`Failed to fetch channels: ${error.message}`);
      }

      return data || [];
    });

    // Step 2: Trigger sync event for each channel
    await step.run('trigger-channel-syncs', async () => {
      for (const channel of channels) {
        await inngestClient.send({
          name: 'youtube/channel.sync',
          data: {
            channelId: channel.id,
            userId: channel.user_id,
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
