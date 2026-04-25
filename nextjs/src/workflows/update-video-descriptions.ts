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
  renderSnapshot: Record<string, Record<string, string>>;
  renderVersion: number;
  userId: string;
  organizationId: string | null;
}

export async function updateVideoDescriptionsWorkflow(payload: PushPayload) {
  "use workflow";

  return await runUpdateVideoDescription(payload);
}

async function runUpdateVideoDescription(payload: PushPayload) {
  "use step";

  const {
    videoId,
    videoIdYouTube,
    channelId,
    newDescription,
    renderSnapshot,
    renderVersion,
    userId,
  } = payload;

  const canonical = newDescription.replace(/\s+$/, "");
  const accessToken = await getChannelAccessToken(channelId);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '30s'`);

    const currentRows = await tx.execute(sql<{
      renderVersion: number;
      driftDetectedAt: Date | null;
    }>`
      select render_version as "renderVersion",
             drift_detected_at as "driftDetectedAt"
      from youtube_videos
      where id = ${videoId}
      for update
    `);
    const current = currentRows[0];

    if (!current) {
      console.warn("[update-video-descriptions] video no longer exists — skipping push", {
        videoId,
      });
      return { stale: true as const };
    }

    if (Number(current.renderVersion) !== renderVersion) {
      console.log("[update-video-descriptions] stale push discarded", {
        videoId,
        payloadRenderVersion: renderVersion,
        currentRenderVersion: Number(current.renderVersion),
      });
      return { stale: true as const };
    }

    if (current.driftDetectedAt) {
      console.warn("[update-video-descriptions] overwriting drifted description via template push", {
        videoId,
        driftDetectedAt: current.driftDetectedAt,
      });
    }

    await updateVideoDescription(videoIdYouTube, canonical, accessToken);

    await tx
      .update(youtubeVideos)
      .set({ currentDescription: canonical, driftDetectedAt: null })
      .where(eq(youtubeVideos.id, videoId));

    const nextVersionRows = await tx.execute(sql<{ next: number }>`
      select coalesce(max(version_number), 0) + 1 as next
      from description_history where video_id = ${videoId}
    `);
    const nextVersion = Number(nextVersionRows[0]?.next ?? 1);

    await tx.insert(descriptionHistory).values({
      videoId,
      description: canonical,
      versionNumber: nextVersion,
      renderSnapshot,
      createdBy: userId,
      source: "template_push",
    });

    return { stale: false as const };
  });

  if (result.stale) {
    return { success: true, videoId, stale: true };
  }

  return { success: true, videoId };
}
