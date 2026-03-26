import {
  eq,
  and,
  desc,
  asc,
  ilike,
  isNull,
  lt,
  gt,
  count,
  inArray,
  sql,
  getTableColumns,
} from "drizzle-orm";
import { db } from "@/db";
import {
  youtubeVideos,
  youtubeChannels,
  containers,
  templates,
  videoVariables,
  descriptionHistory,
} from "@/db/schema";
import { getChannelTokens, resolveVideo } from "@/lib/api-auth";
import {
  fetchVideoDetails,
  fetchVideoAnalytics,
  fetchVideoRetention,
} from "@/lib/clients/youtube";
import { parseUserVariables } from "@/utils/templateParser";
import { checkVideoLimit } from "@/lib/plan-limits";
import { tasks } from "@trigger.dev/sdk/v3";
import type { ServiceResult, PaginationMeta } from "./types";

// ── list_videos ──────────────────────────────────────────────

export interface ListVideosOpts {
  channelId?: string;
  containerId?: string;
  search?: string;
  unassigned?: boolean;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export async function listVideos(
  userId: string,
  opts: ListVideosOpts
): Promise<ServiceResult<{ data: unknown[]; meta: PaginationMeta }>> {
  try {
    const limit = Math.min(opts.limit ?? 50, 100);
    const sortParam = opts.sort ?? "publishedAt:desc";

    const filters: ReturnType<typeof eq>[] = [eq(youtubeChannels.userId, userId)];
    if (opts.channelId) filters.push(eq(youtubeChannels.channelId, opts.channelId));
    if (opts.containerId) filters.push(eq(youtubeVideos.containerId, opts.containerId));
    if (opts.search) filters.push(ilike(youtubeVideos.title, `%${opts.search}%`));
    if (opts.unassigned) filters.push(isNull(youtubeVideos.containerId));

    if (opts.cursor) {
      const [, sortDir] = sortParam.split(":");
      if (sortDir === "asc") {
        filters.push(gt(youtubeVideos.publishedAt, new Date(opts.cursor)));
      } else {
        filters.push(lt(youtubeVideos.publishedAt, new Date(opts.cursor)));
      }
    }

    const [sortField, sortDir] = sortParam.split(":");
    const orderBy =
      sortField === "title"
        ? sortDir === "asc" ? asc(youtubeVideos.title) : desc(youtubeVideos.title)
        : sortDir === "asc" ? asc(youtubeVideos.publishedAt) : desc(youtubeVideos.publishedAt);

    const { currentDescription: _, ...videoColumns } = getTableColumns(youtubeVideos);
    const results = await db
      .select({
        ...videoColumns,
        channel: {
          id: youtubeChannels.id,
          channelId: youtubeChannels.channelId,
          title: youtubeChannels.title,
        },
        container: { id: containers.id, name: containers.name },
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
      .where(and(...filters))
      .orderBy(orderBy)
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.publishedAt?.toISOString()
        : undefined;

    const baseFilters: ReturnType<typeof eq>[] = [eq(youtubeChannels.userId, userId)];
    if (opts.channelId) baseFilters.push(eq(youtubeChannels.channelId, opts.channelId));
    if (opts.containerId) baseFilters.push(eq(youtubeVideos.containerId, opts.containerId));
    if (opts.search) baseFilters.push(ilike(youtubeVideos.title, `%${opts.search}%`));
    if (opts.unassigned) baseFilters.push(isNull(youtubeVideos.containerId));

    const [totalResult] = await db
      .select({ total: count() })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(and(...baseFilters));

    return {
      data: {
        data: items,
        meta: { cursor: nextCursor, hasMore, total: totalResult?.total ?? 0 },
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch videos", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_video ────────────────────────────────────────────────

export async function getVideo(
  id: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const resolved = await resolveVideo(id, userId);
    if (!resolved) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    const { currentDescription: _cd, ...videoCols } = getTableColumns(youtubeVideos);
    const [video] = await db
      .select({
        ...videoCols,
        channel: {
          id: youtubeChannels.id,
          channelId: youtubeChannels.channelId,
          title: youtubeChannels.title,
          userId: youtubeChannels.userId,
        },
        container: { id: containers.id, name: containers.name },
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
      .where(eq(youtubeVideos.id, resolved.id));

    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    const tokens = await getChannelTokens(video.channel.channelId, userId);
    let youtubeData = null;
    if (!("error" in tokens)) {
      try {
        const details = await fetchVideoDetails(tokens.accessToken, [video.videoId]);
        youtubeData = details[0] ?? null;
      } catch { /* YouTube fetch failed — return DB data only */ }
    }

    return { data: { ...video, youtube: youtubeData } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch video details", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_video_analytics ──────────────────────────────────────

export interface VideoAnalyticsOpts {
  startDate?: string;
  endDate?: string;
  metrics?: string;
  dimensions?: string;
}

export async function getVideoAnalytics(
  id: string,
  userId: string,
  opts: VideoAnalyticsOpts
): Promise<ServiceResult<unknown>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    const now = new Date();
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const startDate = opts.startDate ?? twentyEightDaysAgo.toISOString().split("T")[0]!;
    const endDate = opts.endDate ?? now.toISOString().split("T")[0]!;
    const metrics = opts.metrics ?? "views,estimatedMinutesWatched,averageViewDuration";
    const dimensions = opts.dimensions ?? "day";

    const tokens = await getChannelTokens(video.channelYoutubeId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const data = await fetchVideoAnalytics(tokens.accessToken, video.videoId, metrics, dimensions, startDate, endDate);
    return { data };
  } catch {
    return { error: { code: "ANALYTICS_ERROR", message: "Failed to fetch video analytics", suggestion: "Ensure your channel has analytics access", status: 500 } };
  }
}

// ── get_video_retention ──────────────────────────────────────

export async function getVideoRetention(
  id: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    const tokens = await getChannelTokens(video.channelYoutubeId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const rawData = await fetchVideoRetention(tokens.accessToken, video.videoId);
    const retentionCurve = (rawData.rows ?? []).map((row: unknown[]) => ({
      position: row[0] as number,
      watchRatio: row[1] as number,
      relativePerformance: row[2] as number,
    }));

    return { data: retentionCurve };
  } catch {
    return { error: { code: "ANALYTICS_ERROR", message: "Failed to fetch retention data", suggestion: "Ensure your channel has analytics access and the video has sufficient views", status: 500 } };
  }
}

// ── get_video_variables ──────────────────────────────────────

export async function getVideoVariables(
  id: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    const variables = await db
      .select({
        ...getTableColumns(videoVariables),
        template: { id: templates.id, name: templates.name },
      })
      .from(videoVariables)
      .leftJoin(templates, eq(videoVariables.templateId, templates.id))
      .where(eq(videoVariables.videoId, video.id));

    return { data: variables };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch variables", suggestion: "Try again later", status: 500 } };
  }
}

// ── assign_video ─────────────────────────────────────────────

export async function assignVideo(
  id: string,
  containerId: string,
  userId: string
): Promise<ServiceResult<{ success: true }>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    if (video.containerId) {
      return { error: { code: "ALREADY_ASSIGNED", message: "Video is already assigned to a container", suggestion: "Unassign the video first or use a different video", status: 400 } };
    }

    const channels = await db
      .select({ id: youtubeChannels.id })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.userId, userId));
    const channelIds = channels.map((c) => c.id);

    if (channelIds.length > 0) {
      const [countResult] = await db
        .select({ assignedCount: count() })
        .from(youtubeVideos)
        .where(and(inArray(youtubeVideos.channelId, channelIds), sql`${youtubeVideos.containerId} IS NOT NULL`));

      const limitCheck = await checkVideoLimit(userId, db);
      if ((countResult?.assignedCount ?? 0) >= limitCheck.limit) {
        return { error: { code: "VIDEO_LIMIT_REACHED", message: `Assigned video limit reached (${limitCheck.limit} on ${limitCheck.planTier} plan)`, suggestion: "Upgrade your plan to assign more videos", status: 403 } };
      }
    }

    const [container] = await db
      .select({ id: containers.id, templateOrder: containers.templateOrder })
      .from(containers)
      .where(and(eq(containers.id, containerId), eq(containers.userId, userId)));

    if (!container) {
      return { error: { code: "CONTAINER_NOT_FOUND", message: "Container not found", suggestion: "Check the container ID", status: 404 } };
    }

    await db.update(youtubeVideos).set({ containerId }).where(eq(youtubeVideos.id, video.id));

    if (container.templateOrder && container.templateOrder.length > 0) {
      const templatesData = await db
        .select({ id: templates.id, content: templates.content })
        .from(templates)
        .where(inArray(templates.id, container.templateOrder));

      const variablesToCreate: Array<{
        videoId: string;
        templateId: string;
        variableName: string;
        variableValue: string;
      }> = [];

      for (const template of templatesData) {
        for (const varName of parseUserVariables(template.content)) {
          variablesToCreate.push({
            videoId: video.id,
            templateId: template.id,
            variableName: varName,
            variableValue: "",
          });
        }
      }

      if (variablesToCreate.length > 0) {
        await db.insert(videoVariables).values(variablesToCreate);
      }
    }

    return { data: { success: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to assign video", suggestion: "Try again later", status: 500 } };
  }
}

// ── update_video_variables ───────────────────────────────────

export interface VariableUpdate {
  templateId: string;
  name: string;
  value: string;
}

export async function updateVideoVariables(
  id: string,
  variables: VariableUpdate[],
  userId: string
): Promise<ServiceResult<{ success: true }>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    for (const variable of variables) {
      await db
        .insert(videoVariables)
        .values({
          videoId: video.id,
          templateId: variable.templateId,
          variableName: variable.name,
          variableValue: variable.value,
        })
        .onConflictDoUpdate({
          target: [videoVariables.videoId, videoVariables.templateId, videoVariables.variableName],
          set: { variableValue: variable.value },
        });
    }

    await tasks.trigger("youtube-update-video-descriptions", {
      videoIds: [video.id],
      userId,
    });

    return { data: { success: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to update variables", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_description_history ──────────────────────────────────

export async function getDescriptionHistory(
  id: string,
  userId: string,
  limit?: number
): Promise<ServiceResult<unknown>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    const maxEntries = Math.min(limit ?? 50, 100);

    const history = await db
      .select()
      .from(descriptionHistory)
      .where(eq(descriptionHistory.videoId, video.id))
      .orderBy(desc(descriptionHistory.versionNumber))
      .limit(maxEntries);

    return { data: history };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch description history", suggestion: "Try again later", status: 500 } };
  }
}

// ── revert_description ───────────────────────────────────────

export async function revertDescription(
  id: string,
  historyId: string,
  userId: string
): Promise<ServiceResult<{ success: true; delinkedContainer: boolean; variablesCleared: number }>> {
  try {
    const video = await resolveVideo(id, userId);
    if (!video) {
      return { error: { code: "VIDEO_NOT_FOUND", message: "Video not found", suggestion: "Pass a VidTempla UUID or YouTube video ID", status: 404 } };
    }

    // Get the historical description
    const [history] = await db
      .select({ description: descriptionHistory.description })
      .from(descriptionHistory)
      .where(
        and(
          eq(descriptionHistory.id, historyId),
          eq(descriptionHistory.videoId, video.id)
        )
      );

    if (!history) {
      return { error: { code: "HISTORY_NOT_FOUND", message: "History entry not found", suggestion: "Check the history ID — use get_description_history to list available entries", status: 404 } };
    }

    // Get current video state for return metadata
    const [currentVideo] = await db
      .select({ containerId: youtubeVideos.containerId })
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, video.id));

    const existingVars = await db
      .select({ id: videoVariables.id })
      .from(videoVariables)
      .where(eq(videoVariables.videoId, video.id));

    const hadContainer = !!currentVideo?.containerId;
    const variableCount = existingVars?.length || 0;

    // Delink: set containerId to null
    if (hadContainer) {
      await db
        .update(youtubeVideos)
        .set({ containerId: null })
        .where(eq(youtubeVideos.id, video.id));
    }

    // Clear all video variables
    if (variableCount > 0) {
      await db
        .delete(videoVariables)
        .where(eq(videoVariables.videoId, video.id));
    }

    // Update current description
    await db
      .update(youtubeVideos)
      .set({ currentDescription: history.description })
      .where(eq(youtubeVideos.id, video.id));

    // Trigger task to push to YouTube
    await tasks.trigger("youtube-update-video-descriptions", {
      videoIds: [video.id],
      userId,
    });

    return {
      data: {
        success: true,
        delinkedContainer: hadContainer,
        variablesCleared: variableCount,
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to revert description", suggestion: "Try again later", status: 500 } };
  }
}
