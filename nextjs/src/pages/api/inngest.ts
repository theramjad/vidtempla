import { aggregatorRun } from "@/inngest/aggregator";
import { syncChannelVideos } from "@/inngest/youtube/syncChannelVideos";
import { updateVideoDescriptions } from "@/inngest/youtube/updateVideoDescriptions";
import { scheduledSync } from "@/inngest/youtube/scheduledSync";
import { inngestClient } from "@/lib/clients/inngest";
import { serve } from "inngest/next";

export const config = {
  maxDuration: 720, // 12 minutes
};

export default serve({
  client: inngestClient,
  functions: [
    // Aggregator (legacy)
    aggregatorRun,

    // YouTube background jobs
    syncChannelVideos,
    updateVideoDescriptions,
    scheduledSync,
  ],
});
