import {
  eq,
  and,
  desc,
  asc,
  ilike,
  isNull,
  isNotNull,
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
import {
  getChannelTokens,
  getAnyUserToken,
  resolveVideo,
  videoNotFoundError,
} from "@/lib/api-auth";
import {
  fetchChannelVideos,
  fetchVideoDetails,
  fetchVideoAnalytics,
  fetchVideoRetention,
  resolveChannelId,
  updateVideoDescription,
  getChannelAccessToken,
} from "@/lib/clients/youtube";
import { parseUserVariables, buildDescription } from "@/utils/templateParser";
import { checkVideoLimit } from "@/lib/plan-limits";
import { tasks } from "@trigger.dev/sdk/v3";
import type { ServiceResult, PaginationMeta, JsonValue } from "./types";
import { assertNoDrift, detectAndRecordDrift } from "./drift";

export interface ListVideosOpts {
  channelId?: string;
  containerId?: string;
  search?: string;
  unassigned?: boolean;
  sort?: string;
  cursor?: string;
  limit?: number;
  hasDrift?: boolean;
}

async function syncOwnedChannelVideos(
  channelYoutubeId: string,
  userId: string,
  organizationId?: string
) {
  const tokens = await getChannelTokens(channelYoutubeId, userId, organizationId);
  if ("error" in tokens) {
    return false;
  }

  try {
    const [channel] = await db
      .select({
        id: youtubeChannels.id,
        driftBaselinedAt: youtubeChannels.driftBaselinedAt,
      })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.id, tokens.channelDbId));

    if (!channel) return true;

    const isBaseline = channel.driftBaselinedAt === null;
    let nextPageToken: string | undefined;

    do {
      const page = await fetchChannelVideos(channelYoutubeId, tokens.accessToken, nextPageToken);

      for (const v of page.videos) {
        const [existing] = await db
          .select({ id: youtubeVideos.id })
          .from(youtubeVideos)
          .where(eq(youtubeVideos.videoId, v.id));

        if (!existing) {
          const [inserted] = await db
            .insert(youtubeVideos)
            .values({
              channelId: tokens.channelDbId,
              videoId: v.id,
              title: v.snippet.title,
              currentDescription: v.snippet.description,
              publishedAt: new Date(v.snippet.publishedAt),
            })
            .returning({ id: youtubeVideos.id });

          if (inserted) {
            await db.insert(descriptionHistory).values({
              videoId: inserted.id,
              description: v.snippet.description,
              versionNumber: 1,
              createdBy: userId,
              source: "initial_sync",
            });
          }
        } else {
          await db
            .update(youtubeVideos)
            .set({
              title: v.snippet.title,
              publishedAt: new Date(v.snippet.publishedAt),
              updatedAt: new Date(),
            })
            .where(eq(youtubeVideos.id, existing.id));

          if (isBaseline) {
            await db
              .update(youtubeVideos)
              .set({ currentDescription: v.snippet.description, updatedAt: new Date() })
              .where(eq(youtubeVideos.id, existing.id));
          } else {
            await db.transaction(async (tx) => {
              await detectAndRecordDrift(existing.id, v.snippet.description, userId, tx);
            });
          }
        }
      }

      nextPageToken = page.nextPageToken;
    } while (nextPageToken);

    if (isBaseline) {
      await db
        .update(youtubeChannels)
        .set({ driftBaselinedAt: new Date() })
        .where(
          and(
            eq(youtubeChannels.id, tokens.channelDbId),
            sql`${youtubeChannels.driftBaselinedAt} IS NULL`
          )
        );
    }
  } catch {
    // YouTube sync failed — fall through to DB query with stale data
  }

  return true;
}

export async function listVideos(
  userId: string,
  opts: ListVideosOpts,
  organizationId?: string
): Promise<ServiceResult<{ data: any[]; meta: PaginationMeta; source: "db" | "youtube" }>> {
  try {
    if (opts.channelId && !/^UC[\w-]{22}$/.test(opts.channelId)) {
      const anyToken = await getAnyUserToken(userId, organizationId);
      if ("error" in anyToken) {
        return {
          error: {
            code: anyToken.error.error.code,
            message: anyToken.error.error.message,
            suggestion: anyToken.error.error.suggestion ?? "",
            status: anyToken.status,
          },
        };
      }
      try {
        opts.channelId = await resolveChannelId(opts.channelId, anyToken.accessToken);
      } catch (e) {
        return {
          error: {
            code: "INVALID_CHANNEL",
            message: e instanceof Error ? e.message : "Failed to resolve channel",
            suggestion: "Pass a UC... channel ID, @handle, or YouTube channel URL",
            status: 400,
          },
        };
      }
    }

    let isOwned = false;
    if (opts.channelId) {
      isOwned = await syncOwnedChannelVideos(opts.channelId, userId, organizationId);
    }

    if (opts.channelId && !isOwned) {
      const anyToken = await getAnyUserToken(userId, organizationId);
      if ("error" in anyToken) {
        return {
          error: {
            code: anyToken.error.error.code,
            message: anyToken.error.error.message,
            suggestion: anyToken.error.error.suggestion ?? "",
            status: anyToken.status,
          },
        };
      }

      const limit = Math.min(opts.limit ?? 50, 100);
      const videos: Array<{
        videoId: string;
        title: string;
        currentDescription: string;
        publishedAt: string;
        driftDetectedAt: null;
        containerId: null;
        container: null;
        channel: { id: null; channelId: string; title: null };
      }> = [];
      let nextPageToken: string | undefined;

      do {
        const page = await fetchChannelVideos(opts.channelId, anyToken.accessToken, nextPageToken);
        for (const v of page.videos) {
          videos.push({
            videoId: v.id,
            title: v.snippet.title,
            currentDescription: v.snippet.description,
            publishedAt: v.snippet.publishedAt,
            driftDetectedAt: null,
            containerId: null,
            container: null,
            channel: { id: null, channelId: opts.channelId, title: null },
          });
        }
        nextPageToken = page.nextPageToken;
      } while (nextPageToken && videos.length < limit);

      const items = videos.slice(0, limit);
      const hasMore = videos.length > limit || !!nextPageToken;

      return {
        data: {
          data: items,
          meta: { cursor: undefined, hasMore, total: null },
          source: "youtube",
        },
      };
    }

    const limit = Math.min(opts.limit ?? 50, 100);
    const sortParam = opts.sort ?? "publishedAt:desc";
    const ownerFilter = organizationId
      ? eq(youtubeChannels.organizationId, organizationId)
      : eq(youtubeChannels.userId, userId);
    const filters = [ownerFilter] as any[];

    if (opts.channelId) filters.push(eq(youtubeChannels.channelId, opts.channelId));
    if (opts.containerId) filters.push(eq(youtubeVideos.containerId, opts.containerId));
    if (opts.search) filters.push(ilike(youtubeVideos.title, `%${opts.search}%`));
    if (opts.unassigned) filters.push(isNull(youtubeVideos.containerId));
    if (opts.hasDrift === true) filters.push(isNotNull(youtubeVideos.driftDetectedAt));
    if (opts.hasDrift === false) filters.push(isNull(youtubeVideos.driftDetectedAt));

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
        ? sortDir === "asc"
          ? asc(youtubeVideos.title)
          : desc(youtubeVideos.title)
        : sortDir === "asc"
          ? asc(youtubeVideos.publishedAt)
          : desc(youtubeVideos.publishedAt);

    const results = await db
      .select({
        ...getTableColumns(youtubeVideos),
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
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.publishedAt?.toISOString() : undefined;

    const baseFilters = [ownerFilter] as any[];
    if (opts.channelId) baseFilters.push(eq(youtubeChannels.channelId, opts.channelId));
    if (opts.containerId) baseFilters.push(eq(youtubeVideos.containerId, opts.containerId));
    if (opts.search) baseFilters.push(ilike(youtubeVideos.title, `%${opts.search}%`));
    if (opts.unassigned) baseFilters.push(isNull(youtubeVideos.containerId));
    if (opts.hasDrift === true) baseFilters.push(isNotNull(youtubeVideos.driftDetectedAt));
    if (opts.hasDrift === false) baseFilters.push(isNull(youtubeVideos.driftDetectedAt));

    const [totalResult] = await db
      .select({ total: count() })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(and(...baseFilters));

    return {
      data: {
        data: items,
        meta: { cursor: nextCursor, hasMore, total: totalResult?.total ?? 0 },
        source: "db",
      },
    };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch videos",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export async function getVideo(
  id: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<any>> {
  try {
    const result = await resolveVideo(id, userId, organizationId);
    if (!result.found) return { error: videoNotFoundError(result.reason) };
    const resolved = result.video;

    const [video] = await db
      .select({
        ...getTableColumns(youtubeVideos),
        channel: {
          id: youtubeChannels.id,
          channelId: youtubeChannels.channelId,
          title: youtubeChannels.title,
          userId: youtubeChannels.userId,
        },
        container: { id: containers.id, name: containers.name, separator: containers.separator, templateOrder: containers.templateOrder },
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
      .where(eq(youtubeVideos.id, resolved.id));

    if (!video) {
      return {
        error: {
          code: "VIDEO_NOT_FOUND",
          message: "Video not found",
          suggestion: "Pass a VidTempla UUID or YouTube video ID",
          status: 404,
        },
      };
    }

    const tokens = await getChannelTokens(video.channel.channelId, userId, organizationId);
    let youtubeData = null;
    if (!("error" in tokens)) {
      try {
        const details = await fetchVideoDetails(tokens.accessToken, [video.videoId]);
        youtubeData = details[0] ?? null;
      } catch {
        // ignore live fetch failure
      }
    }

    return { data: { ...video, youtube: youtubeData } };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch video details",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export interface VideoAnalyticsOpts {
  startDate?: string;
  endDate?: string;
  metrics?: string;
  dimensions?: string;
}

export async function getVideoAnalytics(
  id: string,
  userId: string,
  opts: VideoAnalyticsOpts,
  organizationId?: string
): Promise<ServiceResult<any>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const now = new Date();
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const startDate = opts.startDate ?? twentyEightDaysAgo.toISOString().split("T")[0]!;
    const endDate = opts.endDate ?? now.toISOString().split("T")[0]!;
    const metrics = opts.metrics ?? "views,estimatedMinutesWatched,averageViewDuration";
    const dimensions = opts.dimensions ?? "day";

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return {
        error: {
          code: tokens.error.error.code,
          message: tokens.error.error.message,
          suggestion: tokens.error.error.suggestion ?? "",
          status: tokens.status,
        },
      };
    }

    const data = await fetchVideoAnalytics(tokens.accessToken, video.videoId, metrics, dimensions, startDate, endDate);
    return { data };
  } catch {
    return {
      error: {
        code: "ANALYTICS_ERROR",
        message: "Failed to fetch video analytics",
        suggestion: "Ensure your channel has analytics access",
        status: 500,
      },
    };
  }
}

export async function getVideoRetention(
  id: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<any>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return {
        error: {
          code: tokens.error.error.code,
          message: tokens.error.error.message,
          suggestion: tokens.error.error.suggestion ?? "",
          status: tokens.status,
        },
      };
    }

    const rawData = await fetchVideoRetention(tokens.accessToken, video.videoId);
    const retentionCurve = (rawData.rows ?? []).map((row: Array<string | number>) => ({
      position: row[0] as number,
      watchRatio: row[1] as number,
      relativePerformance: row[2] as number,
    }));

    return { data: retentionCurve };
  } catch {
    return {
      error: {
        code: "ANALYTICS_ERROR",
        message: "Failed to fetch retention data",
        suggestion: "Ensure your channel has analytics access and the video has sufficient views",
        status: 500,
      },
    };
  }
}

export async function getVideoVariables(
  id: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<any>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const variables = await db
      .select({
        ...getTableColumns(videoVariables),
        template: { id: templates.id, name: templates.name, content: templates.content },
      })
      .from(videoVariables)
      .leftJoin(templates, eq(videoVariables.templateId, templates.id))
      .where(eq(videoVariables.videoId, video.id));

    const [videoData] = await db
      .select({
        videoId: youtubeVideos.videoId,
        container: {
          id: containers.id,
          templateOrder: containers.templateOrder,
          separator: containers.separator,
        },
      })
      .from(youtubeVideos)
      .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
      .where(eq(youtubeVideos.id, video.id));

    return { data: { variables, video: videoData || null } };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch variables",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export async function assignVideo(
  id: string,
  containerId: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<{ success: true }>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    if (video.containerId) {
      return {
        error: {
          code: "ALREADY_ASSIGNED",
          message: "Video is already assigned to a container",
          suggestion: "Unassign the video first or use a different video",
          status: 400,
        },
      };
    }

    const channelOwnerFilter = organizationId
      ? eq(youtubeChannels.organizationId, organizationId)
      : eq(youtubeChannels.userId, userId);
    const channels = await db.select({ id: youtubeChannels.id }).from(youtubeChannels).where(channelOwnerFilter);
    const channelIds = channels.map((c) => c.id);

    if (channelIds.length > 0) {
      const [countResult] = await db
        .select({ assignedCount: count() })
        .from(youtubeVideos)
        .where(and(inArray(youtubeVideos.channelId, channelIds), sql`${youtubeVideos.containerId} IS NOT NULL`));

      const limitCheck = await checkVideoLimit(organizationId ?? userId, db);
      if ((countResult?.assignedCount ?? 0) >= limitCheck.limit) {
        return {
          error: {
            code: "VIDEO_LIMIT_REACHED",
            message: `Assigned video limit reached (${limitCheck.limit} on ${limitCheck.planTier} plan)`,
            suggestion: "Upgrade your plan to assign more videos",
            status: 403,
          },
        };
      }
    }

    const containerOwnerFilter = organizationId
      ? eq(containers.organizationId, organizationId)
      : eq(containers.userId, userId);
    const [container] = await db
      .select({ id: containers.id, templateOrder: containers.templateOrder })
      .from(containers)
      .where(and(eq(containers.id, containerId), containerOwnerFilter));

    if (!container) {
      return {
        error: {
          code: "CONTAINER_NOT_FOUND",
          message: "Container not found",
          suggestion: "Check the container ID",
          status: 404,
        },
      };
    }

    await db
      .update(youtubeVideos)
      .set({ containerId, driftDetectedAt: null })
      .where(eq(youtubeVideos.id, video.id));

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
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to assign video",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export interface VariableUpdate {
  templateId: string;
  name: string;
  value: string;
}

export async function pushVideoDescriptions(
  videoIds: string[],
  userId: string,
  opts: { force?: boolean } = {}
): Promise<ServiceResult<{ success: true }>> {
  const blocked = await assertNoDrift(videoIds, opts);
  if (blocked) {
    return {
      error: {
        code: "VIDEO_HAS_DRIFT",
        message: `Video was edited on YouTube on ${blocked.blocked.driftDetectedAt ?? "an unknown date"}`,
        suggestion:
          "Review the edit with get_description_history, then retry with force: true to overwrite OR call resolve_drift with strategy 'keep_youtube_edit' to preserve it",
        status: 409,
        meta: {
          driftedVideoIds: blocked.blocked.driftedVideoIds,
          driftDetectedAt: blocked.blocked.driftDetectedAt,
          latestManualEditHistoryId: blocked.blocked.latestManualEditHistoryId,
        },
      },
    };
  }

  await tasks.trigger("youtube-update-video-descriptions", { videoIds, userId });
  return { data: { success: true } };
}

export async function updateVideoVariables(
  id: string,
  variables: VariableUpdate[],
  userId: string,
  organizationId?: string,
  opts: { force?: boolean } = {}
): Promise<ServiceResult<{ success: true }>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const blocked = await assertNoDrift([video.id], opts);
    if (blocked) {
      return {
        error: {
          code: "VIDEO_HAS_DRIFT",
          message: `Video was edited on YouTube on ${blocked.blocked.driftDetectedAt ?? "an unknown date"}`,
          suggestion:
            "Review the edit with get_description_history, then retry with force: true to overwrite OR call resolve_drift with strategy 'keep_youtube_edit' to preserve it",
          status: 409,
          meta: {
            driftedVideoIds: blocked.blocked.driftedVideoIds,
            driftDetectedAt: blocked.blocked.driftDetectedAt,
            latestManualEditHistoryId: blocked.blocked.latestManualEditHistoryId,
          },
        },
      };
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

    return await pushVideoDescriptions([video.id], userId, opts);
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update variables",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export async function getDescriptionHistory(
  id: string,
  userId: string,
  limit?: number,
  organizationId?: string
): Promise<ServiceResult<any>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const maxEntries = Math.min(limit ?? 50, 100);
    const history = await db
      .select()
      .from(descriptionHistory)
      .where(eq(descriptionHistory.videoId, video.id))
      .orderBy(desc(descriptionHistory.versionNumber))
      .limit(maxEntries);

    return { data: history };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch description history",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export async function checkDrift(
  id: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<{ hasDrift: boolean; stored: string; live: string; driftDetectedAt: Date | null }>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const [storedVideo] = await db
      .select({
        id: youtubeVideos.id,
        videoId: youtubeVideos.videoId,
        channelId: youtubeVideos.channelId,
        currentDescription: youtubeVideos.currentDescription,
        driftDetectedAt: youtubeVideos.driftDetectedAt,
      })
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, video.id));

    if (!storedVideo) return { error: videoNotFoundError("not_owned") };

    const accessToken = await getChannelAccessToken(storedVideo.channelId);
    const details = await fetchVideoDetails(accessToken, [storedVideo.videoId]);
    const live = details[0]?.snippet?.description ?? "";
    const stored = storedVideo.currentDescription ?? "";

    return {
      data: {
        hasDrift: live !== stored,
        stored,
        live,
        driftDetectedAt: storedVideo.driftDetectedAt,
      },
    };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to check drift",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export async function revertDescription(
  id: string,
  historyId: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<{ success: true; delinkedContainer: boolean; variablesCleared: number }>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    const [history] = await db
      .select({ description: descriptionHistory.description })
      .from(descriptionHistory)
      .where(and(eq(descriptionHistory.id, historyId), eq(descriptionHistory.videoId, video.id)));

    if (!history) {
      return {
        error: {
          code: "HISTORY_NOT_FOUND",
          message: "History entry not found",
          suggestion: "Check the history ID — use get_description_history to list available entries",
          status: 404,
        },
      };
    }

    const [currentVideo] = await db
      .select({ containerId: youtubeVideos.containerId, videoId: youtubeVideos.videoId, channelId: youtubeVideos.channelId })
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, video.id));

    const existingVars = await db
      .select({ id: videoVariables.id })
      .from(videoVariables)
      .where(eq(videoVariables.videoId, video.id));

    const hadContainer = !!currentVideo?.containerId;
    const variableCount = existingVars.length;

    const latestHistory = await db
      .select({ versionNumber: descriptionHistory.versionNumber })
      .from(descriptionHistory)
      .where(eq(descriptionHistory.videoId, video.id))
      .orderBy(desc(descriptionHistory.versionNumber))
      .limit(1);

    const accessToken = await getChannelAccessToken(currentVideo!.channelId);
    await updateVideoDescription(currentVideo!.videoId, history.description, accessToken);

    await db.transaction(async (tx) => {
      if (hadContainer) {
        await tx
          .update(youtubeVideos)
          .set({ containerId: null, driftDetectedAt: null })
          .where(eq(youtubeVideos.id, video.id));
      } else {
        await tx
          .update(youtubeVideos)
          .set({ driftDetectedAt: null })
          .where(eq(youtubeVideos.id, video.id));
      }

      if (variableCount > 0) {
        await tx.delete(videoVariables).where(eq(videoVariables.videoId, video.id));
      }

      await tx
        .update(youtubeVideos)
        .set({ currentDescription: history.description, driftDetectedAt: null })
        .where(eq(youtubeVideos.id, video.id));

      await tx.insert(descriptionHistory).values({
        videoId: video.id,
        description: history.description,
        versionNumber: (latestHistory[0]?.versionNumber ?? 0) + 1,
        createdBy: userId,
        source: "revert",
      });
    });

    return {
      data: {
        success: true,
        delinkedContainer: hadContainer,
        variablesCleared: variableCount,
      },
    };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to revert description",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}

export async function resolveDrift(
  id: string,
  userId: string,
  organizationId: string | undefined,
  input: { strategy: "keep_youtube_edit" | "reapply_template" | "revert_to_version"; historyId?: string; force?: boolean }
): Promise<ServiceResult<{ success: true; delinkedContainer?: boolean; variablesCleared?: number }>> {
  try {
    const videoResult = await resolveVideo(id, userId, organizationId);
    if (!videoResult.found) return { error: videoNotFoundError(videoResult.reason) };
    const video = videoResult.video;

    if (input.strategy === "revert_to_version") {
      if (!input.historyId) {
        return {
          error: {
            code: "HISTORY_ID_REQUIRED",
            message: "historyId is required for revert_to_version",
            suggestion: "Pass a historyId from get_description_history",
            status: 400,
          },
        };
      }
      return revertDescription(id, input.historyId, userId, organizationId);
    }

    const [videoRow] = await db.query.youtubeVideos.findMany({
      where: eq(youtubeVideos.id, video.id),
      with: { container: true, videoVariables: true, youtubeChannel: true },
      limit: 1,
    });

    if (!videoRow) return { error: videoNotFoundError("not_owned") };

    if (input.strategy === "keep_youtube_edit") {
      const existingVars = await db
        .select({ id: videoVariables.id })
        .from(videoVariables)
        .where(eq(videoVariables.videoId, video.id));

      await db.transaction(async (tx) => {
        await tx
          .update(youtubeVideos)
          .set({ containerId: null, driftDetectedAt: null })
          .where(eq(youtubeVideos.id, video.id));
        if (existingVars.length > 0) {
          await tx.delete(videoVariables).where(eq(videoVariables.videoId, video.id));
        }
      });

      return {
        data: {
          success: true,
          delinkedContainer: true,
          variablesCleared: existingVars.length,
        },
      };
    }

    if (!videoRow.container || !videoRow.container.templateOrder?.length) {
      return {
        error: {
          code: "CANNOT_REAPPLY_NO_CONTAINER",
          message: "Video has no container assigned, cannot re-apply template",
          suggestion: "Assign the video to a container first with assign_video, or use strategy 'keep_youtube_edit' to accept the current description",
          status: 400,
        },
      };
    }

    const templatesList = await db
      .select({ id: templates.id, content: templates.content })
      .from(templates)
      .where(inArray(templates.id, videoRow.container.templateOrder));

    const orderedTemplates = videoRow.container.templateOrder
      .map((templateId) => templatesList.find((t) => t.id === templateId))
      .filter((t): t is { id: string; content: string } => Boolean(t));

    const variablesMap: Record<string, string> = {};
    for (const v of videoRow.videoVariables) {
      variablesMap[v.variableName] = v.variableValue || "";
    }

    const description = buildDescription(
      orderedTemplates,
      variablesMap,
      videoRow.container.separator,
      videoRow.videoId
    );

    const latestHistory = await db
      .select({ versionNumber: descriptionHistory.versionNumber })
      .from(descriptionHistory)
      .where(eq(descriptionHistory.videoId, video.id))
      .orderBy(desc(descriptionHistory.versionNumber))
      .limit(1);

    const accessToken = await getChannelAccessToken(videoRow.channelId);
    await updateVideoDescription(videoRow.videoId, description, accessToken);

    await db.transaction(async (tx) => {
      await tx
        .update(youtubeVideos)
        .set({ currentDescription: description, driftDetectedAt: null })
        .where(eq(youtubeVideos.id, video.id));
      await tx.insert(descriptionHistory).values({
        videoId: video.id,
        description,
        versionNumber: (latestHistory[0]?.versionNumber ?? 0) + 1,
        createdBy: userId,
        source: "template_push",
      });
    });

    return { data: { success: true } };
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to resolve drift",
        suggestion: "Try again later",
        status: 500,
      },
    };
  }
}
