import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { descriptionHistory, youtubeVideos } from "@/db/schema";

export interface DriftBlockInfo {
  driftedVideoIds: string[];
  driftDetectedAt: string | null;
  latestManualEditHistoryId: string | null;
}

export async function detectAndRecordDrift(
  videoIdInternal: string,
  liveDescription: string,
  userId: string,
  tx: any
): Promise<{ drifted: boolean; skippedDedup: boolean }> {
  const now = new Date();

  const lockedRows = await tx.execute(sql<{
    id: string;
    currentDescription: string | null;
    containerId: string | null;
  }>`
    select id, current_description as "currentDescription", container_id as "containerId"
    from youtube_videos
    where id = ${videoIdInternal}
    for update
  `);

  const lockedVideo = lockedRows[0];
  if (!lockedVideo || lockedVideo.currentDescription === null) {
    return { drifted: false, skippedDedup: false };
  }

  if (lockedVideo.containerId === null) {
    await tx
      .update(youtubeVideos)
      .set({ currentDescription: liveDescription, updatedAt: now })
      .where(eq(youtubeVideos.id, videoIdInternal));
    return { drifted: false, skippedDedup: false };
  }

  const normalize = (s: string) => s.replace(/\s+$/, "");
  if (normalize(lockedVideo.currentDescription) === normalize(liveDescription)) {
    await tx
      .update(youtubeVideos)
      .set({ currentDescription: liveDescription, driftDetectedAt: null, updatedAt: now })
      .where(eq(youtubeVideos.id, videoIdInternal));
    return { drifted: false, skippedDedup: false };
  }

  const latestHistory = await tx
    .select({
      id: descriptionHistory.id,
      description: descriptionHistory.description,
      source: descriptionHistory.source,
      versionNumber: descriptionHistory.versionNumber,
    })
    .from(descriptionHistory)
    .where(eq(descriptionHistory.videoId, videoIdInternal))
    .orderBy(desc(descriptionHistory.versionNumber))
    .limit(1);

  if (
    latestHistory[0]?.description === liveDescription &&
    latestHistory[0]?.source === "manual_youtube_edit"
  ) {
    await tx
      .update(youtubeVideos)
      .set({ currentDescription: liveDescription, driftDetectedAt: now, updatedAt: now })
      .where(eq(youtubeVideos.id, videoIdInternal));
    return { drifted: true, skippedDedup: true };
  }

  const nextVersion = (latestHistory[0]?.versionNumber ?? 0) + 1;

  await tx.insert(descriptionHistory).values({
    videoId: videoIdInternal,
    description: liveDescription,
    versionNumber: nextVersion,
    renderSnapshot: null,
    createdBy: userId,
    source: "manual_youtube_edit",
  });

  await tx
    .update(youtubeVideos)
    .set({ currentDescription: liveDescription, driftDetectedAt: now, updatedAt: now })
    .where(eq(youtubeVideos.id, videoIdInternal));

  return { drifted: true, skippedDedup: false };
}

export async function assertNoDrift(
  videoIds: string[],
  opts: { force?: boolean } = {}
): Promise<{ blocked: DriftBlockInfo } | null> {
  if (opts.force || videoIds.length === 0) {
    return null;
  }

  const driftedVideos = await db
    .select({
      id: youtubeVideos.id,
      driftDetectedAt: youtubeVideos.driftDetectedAt,
    })
    .from(youtubeVideos)
    .where(and(inArray(youtubeVideos.id, videoIds), isNotNull(youtubeVideos.driftDetectedAt)));

  if (driftedVideos.length === 0) {
    return null;
  }

  const firstDrifted = driftedVideos[0]!;
  const latestManualEdit = await db
    .select({ id: descriptionHistory.id })
    .from(descriptionHistory)
    .where(
      and(
        eq(descriptionHistory.videoId, firstDrifted.id),
        eq(descriptionHistory.source, "manual_youtube_edit")
      )
    )
    .orderBy(desc(descriptionHistory.versionNumber))
    .limit(1);

  return {
    blocked: {
      driftedVideoIds: driftedVideos.map((video) => video.id),
      driftDetectedAt: firstDrifted.driftDetectedAt?.toISOString() ?? null,
      latestManualEditHistoryId: latestManualEdit[0]?.id ?? null,
    },
  };
}
