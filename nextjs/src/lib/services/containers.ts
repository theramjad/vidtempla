import { eq, and, desc, lt, count, inArray, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { containers, templates, youtubeVideos } from "@/db/schema";
import type { ServiceResult, PaginationOpts, PaginationMeta } from "./types";
import { assertNoDrift } from "./drift";
import { pushVideoDescriptions } from "./videos";

// ── list_containers ──────────────────────────────────────────

export async function listContainers(
  userId: string,
  opts: PaginationOpts
): Promise<ServiceResult<{ data: unknown[]; meta: PaginationMeta }>> {
  try {
    const limit = Math.min(opts.limit ?? 50, 100);
    const filters: ReturnType<typeof eq>[] = [eq(containers.userId, userId)];
    if (opts.cursor) filters.push(lt(containers.createdAt, new Date(opts.cursor)));

    const results = await db
      .select({
        ...getTableColumns(containers),
        videoCount: count(youtubeVideos.id),
      })
      .from(containers)
      .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
      .where(and(...filters))
      .groupBy(containers.id)
      .orderBy(desc(containers.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1]!.createdAt.toISOString() : undefined;

    const [totalResult] = await db
      .select({ total: count() })
      .from(containers)
      .where(eq(containers.userId, userId));

    return {
      data: {
        data: items,
        meta: { cursor: nextCursor, hasMore, total: totalResult?.total ?? 0 },
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch containers", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_container ────────────────────────────────────────────

export async function getContainer(
  id: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const [container] = await db
      .select({
        ...getTableColumns(containers),
        videoCount: count(youtubeVideos.id),
      })
      .from(containers)
      .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
      .where(and(eq(containers.id, id), eq(containers.userId, userId)))
      .groupBy(containers.id);

    if (!container) {
      return { error: { code: "CONTAINER_NOT_FOUND", message: "Container not found", suggestion: "Check the container ID", status: 404 } };
    }

    let templateDetails: Array<{ id: string; name: string; content: string }> = [];
    if (container.templateOrder && container.templateOrder.length > 0) {
      templateDetails = await db
        .select({ id: templates.id, name: templates.name, content: templates.content })
        .from(templates)
        .where(inArray(templates.id, container.templateOrder));

      templateDetails.sort(
        (a, b) => container.templateOrder!.indexOf(a.id) - container.templateOrder!.indexOf(b.id)
      );
    }

    return { data: { ...container, templates: templateDetails } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to fetch container", suggestion: "Try again later", status: 500 } };
  }
}

// ── create_container ─────────────────────────────────────────

export async function createContainer(
  userId: string,
  name: string,
  templateIds: string[],
  separator?: string
): Promise<ServiceResult<unknown>> {
  try {
    if (!name.trim()) {
      return { error: { code: "INVALID_NAME", message: "name is required", suggestion: "Provide a non-empty name", status: 400 } };
    }

    const [container] = await db
      .insert(containers)
      .values({
        userId,
        name: name.trim(),
        templateOrder: templateIds,
        separator: separator ?? "\n\n",
      })
      .returning();

    return { data: container };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to create container", suggestion: "Try again later", status: 500 } };
  }
}

// ── update_container ─────────────────────────────────────────

export async function updateContainer(
  id: string,
  userId: string,
  data: { name?: string; templateIds?: string[]; separator?: string; force?: boolean }
): Promise<ServiceResult<unknown>> {
  try {
    const updateData: { name?: string; templateOrder?: string[]; separator?: string } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.templateIds !== undefined) updateData.templateOrder = data.templateIds;
    if (data.separator !== undefined) updateData.separator = data.separator;

    if (Object.keys(updateData).length === 0) {
      return { error: { code: "EMPTY_UPDATE", message: "At least one field must be provided", suggestion: "Provide name, templateIds, or separator", status: 400 } };
    }

    let videoIdsToPush: string[] = [];
    if (data.templateIds !== undefined || data.separator !== undefined) {
      const videos = await db
        .select({ id: youtubeVideos.id })
        .from(youtubeVideos)
        .where(eq(youtubeVideos.containerId, id));
      videoIdsToPush = videos.map((v) => v.id);

      if (videoIdsToPush.length > 0) {
        const blocked = await assertNoDrift(videoIdsToPush, { force: data.force });
        if (blocked) {
          return {
            error: {
              code: "VIDEO_HAS_DRIFT",
              message: `${blocked.blocked.driftedVideoIds.length} video(s) in this container were edited on YouTube`,
              suggestion:
                "Review drifted videos with list_videos?hasDrift=true, then retry with force: true to overwrite, or resolve_drift per video",
              status: 409,
              meta: {
                driftedVideoIds: blocked.blocked.driftedVideoIds,
                driftDetectedAt: blocked.blocked.driftDetectedAt,
                latestManualEditHistoryId: blocked.blocked.latestManualEditHistoryId,
              },
            },
          };
        }
      }
    }

    const [container] = await db
      .update(containers)
      .set(updateData)
      .where(and(eq(containers.id, id), eq(containers.userId, userId)))
      .returning();

    if (!container) {
      return { error: { code: "CONTAINER_NOT_FOUND", message: "Container not found", suggestion: "Check the container ID", status: 404 } };
    }

    if (videoIdsToPush.length > 0) {
      await pushVideoDescriptions(videoIdsToPush, userId, { force: data.force });
    }

    return { data: container };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to update container", suggestion: "Try again later", status: 500 } };
  }
}

// ── delete_container ─────────────────────────────────────────

export async function deleteContainer(
  id: string,
  userId: string
): Promise<ServiceResult<{ success: true }>> {
  try {
    const result = await db
      .delete(containers)
      .where(and(eq(containers.id, id), eq(containers.userId, userId)))
      .returning({ id: containers.id });

    if (result.length === 0) {
      return { error: { code: "CONTAINER_NOT_FOUND", message: "Container not found", suggestion: "Check the container ID", status: 404 } };
    }

    return { data: { success: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to delete container", suggestion: "Try again later", status: 500 } };
  }
}
