import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
} from "@/db/schema";
import { getChannelTokens, resolveVideo } from "@/lib/api-auth";
import {
  fetchVideoDetails,
  fetchVideoAnalytics,
  fetchVideoRetention,
} from "@/lib/clients/youtube";
import { parseUserVariables } from "@/utils/templateParser";
import { checkVideoLimit } from "@/lib/plan-limits";
import { inngestClient } from "@/lib/clients/inngest";
import { mcpJson, mcpError } from "../helpers";

export function registerVideoTools(server: McpServer, userId: string) {
  server.tool(
    "list_videos",
    "List videos with filtering, sorting, and cursor pagination",
    {
      channelId: z.string().optional().describe("Filter by YouTube channel ID"),
      containerId: z.string().optional().describe("Filter by container UUID"),
      search: z.string().optional().describe("Search by video title"),
      unassigned: z.boolean().optional().describe("Only show unassigned videos"),
      sort: z.string().optional().describe("Sort field:direction, e.g. publishedAt:desc (default) or title:asc"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    async (args) => {
      try {
        const limit = Math.min(args.limit ?? 50, 100);
        const sortParam = args.sort ?? "publishedAt:desc";

        const filters: ReturnType<typeof eq>[] = [eq(youtubeChannels.userId, userId)];
        if (args.channelId) filters.push(eq(youtubeChannels.channelId, args.channelId));
        if (args.containerId) filters.push(eq(youtubeVideos.containerId, args.containerId));
        if (args.search) filters.push(ilike(youtubeVideos.title, `%${args.search}%`));
        if (args.unassigned) filters.push(isNull(youtubeVideos.containerId));

        if (args.cursor) {
          const [, sortDir] = sortParam.split(":");
          if (sortDir === "asc") {
            filters.push(gt(youtubeVideos.publishedAt, new Date(args.cursor)));
          } else {
            filters.push(lt(youtubeVideos.publishedAt, new Date(args.cursor)));
          }
        }

        const [sortField, sortDir] = sortParam.split(":");
        const orderBy =
          sortField === "title"
            ? sortDir === "asc" ? asc(youtubeVideos.title) : desc(youtubeVideos.title)
            : sortDir === "asc" ? asc(youtubeVideos.publishedAt) : desc(youtubeVideos.publishedAt);

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
        const nextCursor =
          hasMore && items.length > 0
            ? items[items.length - 1]!.publishedAt?.toISOString()
            : undefined;

        const baseFilters: ReturnType<typeof eq>[] = [eq(youtubeChannels.userId, userId)];
        if (args.channelId) baseFilters.push(eq(youtubeChannels.channelId, args.channelId));
        if (args.containerId) baseFilters.push(eq(youtubeVideos.containerId, args.containerId));
        if (args.search) baseFilters.push(ilike(youtubeVideos.title, `%${args.search}%`));
        if (args.unassigned) baseFilters.push(isNull(youtubeVideos.containerId));

        const [totalResult] = await db
          .select({ total: count() })
          .from(youtubeVideos)
          .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
          .where(and(...baseFilters));

        return mcpJson({
          data: items,
          meta: { cursor: nextCursor, hasMore, total: totalResult?.total ?? 0 },
        });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch videos", "Try again later");
      }
    }
  );

  server.tool(
    "get_video",
    "Get video details including live YouTube stats (accepts VidTempla UUID or YouTube video ID)",
    { id: z.string().describe("VidTempla UUID or YouTube video ID (e.g. dQw4w9WgXcQ)") },
    async ({ id }) => {
      try {
        const resolved = await resolveVideo(id, userId);
        if (!resolved) {
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
        }

        const [video] = await db
          .select({
            ...getTableColumns(youtubeVideos),
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
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
        }

        const tokens = await getChannelTokens(video.channel.channelId, userId);
        let youtubeData = null;
        if (!("error" in tokens)) {
          try {
            const details = await fetchVideoDetails(tokens.accessToken, [video.videoId]);
            youtubeData = details[0] ?? null;
          } catch { /* YouTube fetch failed — return DB data only */ }
        }

        return mcpJson({ ...video, youtube: youtubeData });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch video details", "Try again later");
      }
    }
  );

  server.tool(
    "get_video_analytics",
    "Get video analytics over a date range (views, watch time, etc.)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 28 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
      metrics: z.string().optional().describe("Comma-separated metrics (default: views,estimatedMinutesWatched,averageViewDuration)"),
      dimensions: z.string().optional().describe("Dimensions (default: day)"),
    },
    async (args) => {
      try {
        const video = await resolveVideo(args.id, userId);
        if (!video) {
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
        }

        const now = new Date();
        const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        const startDate = args.startDate ?? twentyEightDaysAgo.toISOString().split("T")[0]!;
        const endDate = args.endDate ?? now.toISOString().split("T")[0]!;
        const metrics = args.metrics ?? "views,estimatedMinutesWatched,averageViewDuration";
        const dimensions = args.dimensions ?? "day";

        const tokens = await getChannelTokens(video.channelYoutubeId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const data = await fetchVideoAnalytics(tokens.accessToken, video.videoId, metrics, dimensions, startDate, endDate);
        return mcpJson(data);
      } catch {
        return mcpError("ANALYTICS_ERROR", "Failed to fetch video analytics", "Ensure your channel has analytics access");
      }
    }
  );

  server.tool(
    "get_video_retention",
    "Get audience retention curve (100 data points with position, watchRatio, relativePerformance)",
    { id: z.string().describe("VidTempla UUID or YouTube video ID") },
    async ({ id }) => {
      try {
        const video = await resolveVideo(id, userId);
        if (!video) {
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
        }

        const tokens = await getChannelTokens(video.channelYoutubeId, userId);
        if ("error" in tokens) {
          return mcpError(tokens.error.error.code, tokens.error.error.message, tokens.error.error.suggestion);
        }

        const rawData = await fetchVideoRetention(tokens.accessToken, video.videoId);
        const retentionCurve = (rawData.rows ?? []).map((row: unknown[]) => ({
          position: row[0] as number,
          watchRatio: row[1] as number,
          relativePerformance: row[2] as number,
        }));

        return mcpJson(retentionCurve);
      } catch {
        return mcpError("ANALYTICS_ERROR", "Failed to fetch retention data", "Ensure your channel has analytics access and the video has sufficient views");
      }
    }
  );

  server.tool(
    "get_video_variables",
    "Get template variables for a video",
    { id: z.string().describe("VidTempla UUID or YouTube video ID") },
    async ({ id }) => {
      try {
        const video = await resolveVideo(id, userId);
        if (!video) {
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
        }

        const variables = await db
          .select({
            ...getTableColumns(videoVariables),
            template: { id: templates.id, name: templates.name },
          })
          .from(videoVariables)
          .leftJoin(templates, eq(videoVariables.templateId, templates.id))
          .where(eq(videoVariables.videoId, video.id));

        return mcpJson(variables);
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch variables", "Try again later");
      }
    }
  );

  server.tool(
    "assign_video",
    "Assign a video to a container (initializes template variables)",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      containerId: z.string().describe("Container UUID to assign the video to"),
    },
    async ({ id, containerId }) => {
      try {
        const video = await resolveVideo(id, userId);
        if (!video) {
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
        }

        if (video.containerId) {
          return mcpError("ALREADY_ASSIGNED", "Video is already assigned to a container", "Unassign the video first or use a different video");
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
            return mcpError("VIDEO_LIMIT_REACHED", `Assigned video limit reached (${limitCheck.limit} on ${limitCheck.planTier} plan)`, "Upgrade your plan to assign more videos");
          }
        }

        const [container] = await db
          .select({ id: containers.id, templateOrder: containers.templateOrder })
          .from(containers)
          .where(and(eq(containers.id, containerId), eq(containers.userId, userId)));

        if (!container) {
          return mcpError("CONTAINER_NOT_FOUND", "Container not found", "Check the container ID");
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

        return mcpJson({ success: true });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to assign video", "Try again later");
      }
    }
  );

  server.tool(
    "update_video_variables",
    "Update template variable values for a video and trigger description rebuild",
    {
      id: z.string().describe("VidTempla UUID or YouTube video ID"),
      variables: z.array(
        z.object({
          templateId: z.string().describe("Template UUID"),
          name: z.string().describe("Variable name"),
          value: z.string().describe("Variable value"),
        })
      ).describe("Array of variables to update"),
    },
    async ({ id, variables }) => {
      try {
        const video = await resolveVideo(id, userId);
        if (!video) {
          return mcpError("VIDEO_NOT_FOUND", "Video not found", "Pass a VidTempla UUID or YouTube video ID");
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

        await inngestClient.send({
          name: "youtube/videos.update",
          data: { videoIds: [video.id], userId },
        });

        return mcpJson({ success: true });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to update variables", "Try again later");
      }
    }
  );
}
