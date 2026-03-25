import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, desc, lt, count, inArray, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { containers, templates, youtubeVideos } from "@/db/schema";
import { inngestClient } from "@/lib/clients/inngest";
import { mcpJson, mcpError } from "../helpers";

export function registerContainerTools(server: McpServer, userId: string) {
  server.tool(
    "list_containers",
    "List all containers with video counts",
    {
      cursor: z.string().optional().describe("Pagination cursor"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    async (args) => {
      try {
        const limit = Math.min(args.limit ?? 50, 100);
        const filters: ReturnType<typeof eq>[] = [eq(containers.userId, userId)];
        if (args.cursor) filters.push(lt(containers.createdAt, new Date(args.cursor)));

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

        return mcpJson({
          data: items,
          meta: { cursor: nextCursor, hasMore, total: totalResult?.total ?? 0 },
        });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch containers", "Try again later");
      }
    }
  );

  server.tool(
    "get_container",
    "Get container details with ordered templates",
    { id: z.string().describe("Container UUID") },
    async ({ id }) => {
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
          return mcpError("CONTAINER_NOT_FOUND", "Container not found", "Check the container ID");
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

        return mcpJson({ ...container, templates: templateDetails });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch container", "Try again later");
      }
    }
  );

  server.tool(
    "create_container",
    "Create a container that links templates together",
    {
      name: z.string().describe("Container name"),
      templateIds: z.array(z.string()).describe("Ordered array of template UUIDs"),
      separator: z.string().optional().describe("Text between templates (default: two newlines)"),
    },
    async ({ name, templateIds, separator }) => {
      try {
        if (!name.trim()) {
          return mcpError("INVALID_NAME", "name is required", "Provide a non-empty name");
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

        return mcpJson(container);
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to create container", "Try again later");
      }
    }
  );

  server.tool(
    "update_container",
    "Update a container's name, templates, or separator. Changes trigger video description rebuilds.",
    {
      id: z.string().describe("Container UUID"),
      name: z.string().optional().describe("New name"),
      templateIds: z.array(z.string()).optional().describe("New ordered array of template UUIDs"),
      separator: z.string().optional().describe("New separator text"),
    },
    async ({ id, name, templateIds, separator }) => {
      try {
        const updateData: { name?: string; templateOrder?: string[]; separator?: string } = {};
        if (name !== undefined) updateData.name = name;
        if (templateIds !== undefined) updateData.templateOrder = templateIds;
        if (separator !== undefined) updateData.separator = separator;

        if (Object.keys(updateData).length === 0) {
          return mcpError("EMPTY_UPDATE", "At least one field must be provided", "Provide name, templateIds, or separator");
        }

        const [container] = await db
          .update(containers)
          .set(updateData)
          .where(and(eq(containers.id, id), eq(containers.userId, userId)))
          .returning();

        if (!container) {
          return mcpError("CONTAINER_NOT_FOUND", "Container not found", "Check the container ID");
        }

        if (templateIds !== undefined || separator !== undefined) {
          const videos = await db
            .select({ id: youtubeVideos.id })
            .from(youtubeVideos)
            .where(eq(youtubeVideos.containerId, id));

          if (videos.length > 0) {
            await inngestClient.send({
              name: "youtube/videos.update",
              data: { videoIds: videos.map((v) => v.id), userId },
            });
          }
        }

        return mcpJson(container);
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to update container", "Try again later");
      }
    }
  );

  server.tool(
    "delete_container",
    "Delete a container. Videos will be unassigned.",
    { id: z.string().describe("Container UUID") },
    async ({ id }) => {
      try {
        const result = await db
          .delete(containers)
          .where(and(eq(containers.id, id), eq(containers.userId, userId)))
          .returning({ id: containers.id });

        if (result.length === 0) {
          return mcpError("CONTAINER_NOT_FOUND", "Container not found", "Check the container ID");
        }

        return mcpJson({ success: true });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to delete container", "Try again later");
      }
    }
  );
}
