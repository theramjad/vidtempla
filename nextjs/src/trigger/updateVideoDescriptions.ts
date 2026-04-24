import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { youtubeVideos, descriptionHistory } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getChannelAccessToken,
  updateVideoDescription,
} from "@/lib/clients/youtube";

export interface PushPayload {
  videoId: string;
  videoIdYouTube: string;
  channelId: string;
  newDescription: string;
  renderSnapshot: Record<string, string>;
  userId: string;
  organizationId: string | null;
}

export const updateVideoDescriptions = task({
  id: "youtube-update-video-descriptions",
  queue: {
    concurrencyLimit: 5,
  },
  run: async (payload: PushPayload) => {
    const {
      videoId,
      videoIdYouTube,
      channelId,
      newDescription,
      renderSnapshot,
      userId,
    } = payload;

    const [preVideo] = await db
      .select({ driftDetectedAt: youtubeVideos.driftDetectedAt })
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, videoId));

    if (preVideo?.driftDetectedAt) {
      logger.warn("Overwriting drifted description via template push", {
        videoId,
        driftDetectedAt: preVideo.driftDetectedAt,
      });
    }

    const accessToken = await getChannelAccessToken(channelId);

    const canonical = newDescription.replace(/\s+$/, "");

    try {
      await updateVideoDescription(videoIdYouTube, canonical, accessToken);
    } catch (error) {
      logger.error(`Failed to update video ${videoId}`, { error });
      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        select 1 from youtube_videos where id = ${videoId} for update
      `);

      await tx
        .update(youtubeVideos)
        .set({ currentDescription: canonical, driftDetectedAt: null })
        .where(eq(youtubeVideos.id, videoId));

      await tx.insert(descriptionHistory).values({
        videoId,
        description: canonical,
        versionNumber: 0,
        renderSnapshot,
        createdBy: userId,
        source: "template_push",
      });
    });

    return { success: true, videoId };
  },
});
