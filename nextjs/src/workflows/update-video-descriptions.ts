import { db } from "@/db";
import { youtubeVideos, descriptionHistory } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
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

  // Phase 1: validate state in a short read-only txn (no FOR UPDATE — we use CAS
  // on render_version in phase 3 to detect concurrent modifications).
  const preCheckRows = await db.execute(sql<{
    renderVersion: number;
    driftDetectedAt: Date | null;
  }>`
    select render_version as "renderVersion",
           drift_detected_at as "driftDetectedAt"
    from youtube_videos
    where id = ${videoId}
  `);
  const preCheck = preCheckRows[0];

  if (!preCheck) {
    console.warn("[update-video-descriptions] video no longer exists — skipping push", {
      videoId,
    });
    return { success: true, videoId, stale: true };
  }

  if (Number(preCheck.renderVersion) !== renderVersion) {
    console.log("[update-video-descriptions] stale push discarded", {
      videoId,
      payloadRenderVersion: renderVersion,
      currentRenderVersion: Number(preCheck.renderVersion),
    });
    return { success: true, videoId, stale: true };
  }

  if (preCheck.driftDetectedAt) {
    console.warn("[update-video-descriptions] overwriting drifted description via template push", {
      videoId,
      driftDetectedAt: preCheck.driftDetectedAt,
    });
  }

  // Phase 2: external HTTP PUT — performed OUTSIDE any transaction so we never
  // hold a row lock across the YouTube round-trip. If this throws, the DB still
  // reflects the old state and the workflow's existing retry logic kicks in.
  await updateVideoDescription(videoIdYouTube, canonical, accessToken);

  // Phase 3: short write txn with CAS on render_version. If a concurrent writer
  // bumped render_version between phase 1 and phase 3, we abort the local write
  // (YouTube is already updated — the next sync's drift detection will surface
  // any remaining divergence rather than overwriting concurrent intent here).
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '30s'`);

    const updated = await tx
      .update(youtubeVideos)
      .set({ currentDescription: canonical, driftDetectedAt: null })
      .where(
        and(
          eq(youtubeVideos.id, videoId),
          eq(youtubeVideos.renderVersion, renderVersion)
        )
      )
      .returning({ id: youtubeVideos.id });

    if (updated.length === 0) {
      return { casFailed: true as const };
    }

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

    return { casFailed: false as const };
  });

  if (result.casFailed) {
    console.warn(
      "[update-video-descriptions] CAS failed after YouTube PUT — concurrent writer changed render_version; YouTube has new description but DB write skipped (drift detection will reconcile)",
      { videoId, renderVersion }
    );
    return { success: true, videoId, stale: true };
  }

  return { success: true, videoId };
}
