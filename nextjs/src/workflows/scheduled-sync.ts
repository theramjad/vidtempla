import { start } from "workflow/api";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";
import { syncChannelVideosWorkflow } from "./sync-channel-videos";

export async function scheduledSyncWorkflow() {
  "use workflow";

  const channels = await loadChannels();

  for (const channel of channels) {
    await enqueueChannelSync(channel.id, channel.userId);
  }

  console.log("[scheduled-sync] complete", { channelsQueued: channels.length });

  return {
    success: true,
    channelsQueued: channels.length,
    timestamp: new Date().toISOString(),
  };
}

async function loadChannels() {
  "use step";

  return await db
    .select({ id: youtubeChannels.id, userId: youtubeChannels.userId })
    .from(youtubeChannels);
}

async function enqueueChannelSync(channelId: string, userId: string) {
  "use step";

  await start(syncChannelVideosWorkflow, [channelId, userId]);
}
