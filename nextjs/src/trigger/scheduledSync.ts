import { schedules, tasks, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";

export const scheduledSync = schedules.task({
  id: "youtube-scheduled-sync",
  cron: "0 */6 * * *",
  run: async () => {
    const channels = await db
      .select({ id: youtubeChannels.id, userId: youtubeChannels.userId })
      .from(youtubeChannels);

    for (const channel of channels) {
      await tasks.trigger("youtube-sync-channel-videos", {
        channelId: channel.id,
        userId: channel.userId,
      });
    }

    logger.info("Scheduled sync complete", { channelsQueued: channels.length });

    return {
      success: true,
      channelsQueued: channels.length,
      timestamp: new Date().toISOString(),
    };
  },
});
