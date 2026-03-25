import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, desc, lt, count, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { templates, containers, youtubeVideos } from "@/db/schema";
import { parseVariables } from "@/utils/templateParser";
import { inngestClient } from "@/lib/clients/inngest";
import { mcpJson, mcpError } from "../helpers";

export function registerTemplateTools(server: McpServer, userId: string) {
  server.tool(
    "list_templates",
    "List all templates with parsed variables",
    {
      cursor: z.string().optional().describe("Pagination cursor"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    async (args) => {
      try {
        const limit = Math.min(args.limit ?? 50, 100);
        const filters: ReturnType<typeof eq>[] = [eq(templates.userId, userId)];
        if (args.cursor) filters.push(lt(templates.createdAt, new Date(args.cursor)));

        const results = await db
          .select()
          .from(templates)
          .where(and(...filters))
          .orderBy(desc(templates.createdAt))
          .limit(limit + 1);

        const hasMore = results.length > limit;
        const items = hasMore ? results.slice(0, limit) : results;
        const nextCursor =
          hasMore && items.length > 0 ? items[items.length - 1]!.createdAt.toISOString() : undefined;

        const templatesWithVars = items.map((t) => ({
          ...t,
          variables: parseVariables(t.content),
        }));

        const [totalResult] = await db
          .select({ total: count() })
          .from(templates)
          .where(eq(templates.userId, userId));

        return mcpJson({
          data: templatesWithVars,
          meta: { cursor: nextCursor, hasMore, total: totalResult?.total ?? 0 },
        });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch templates", "Try again later");
      }
    }
  );

  server.tool(
    "get_template",
    "Get a single template by ID with parsed variables",
    { id: z.string().describe("Template UUID") },
    async ({ id }) => {
      try {
        const [template] = await db
          .select()
          .from(templates)
          .where(and(eq(templates.id, id), eq(templates.userId, userId)));

        if (!template) {
          return mcpError("TEMPLATE_NOT_FOUND", "Template not found", "Check the template ID");
        }

        return mcpJson({ ...template, variables: parseVariables(template.content) });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch template", "Try again later");
      }
    }
  );

  server.tool(
    "create_template",
    "Create a new template. Use {{variableName}} for placeholders.",
    {
      name: z.string().describe("Template name"),
      content: z.string().describe("Template content with {{variable}} placeholders"),
    },
    async ({ name, content }) => {
      try {
        if (!name.trim()) {
          return mcpError("INVALID_NAME", "name is required", "Provide a non-empty name");
        }

        const [template] = await db
          .insert(templates)
          .values({ userId, name: name.trim(), content })
          .returning();

        return mcpJson({ ...template, variables: parseVariables(content) });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to create template", "Try again later");
      }
    }
  );

  server.tool(
    "update_template",
    "Update a template's name and/or content. If content changes, affected video descriptions are rebuilt.",
    {
      id: z.string().describe("Template UUID"),
      name: z.string().optional().describe("New name"),
      content: z.string().optional().describe("New content"),
    },
    async ({ id, name, content }) => {
      try {
        const updateData: { name?: string; content?: string } = {};
        if (name !== undefined) updateData.name = name;
        if (content !== undefined) updateData.content = content;

        if (Object.keys(updateData).length === 0) {
          return mcpError("EMPTY_UPDATE", "At least one field (name or content) must be provided", "Provide name and/or content");
        }

        const [template] = await db
          .update(templates)
          .set(updateData)
          .where(and(eq(templates.id, id), eq(templates.userId, userId)))
          .returning();

        if (!template) {
          return mcpError("TEMPLATE_NOT_FOUND", "Template not found", "Check the template ID");
        }

        if (content !== undefined) {
          const allContainers = await db
            .select({ id: containers.id, templateOrder: containers.templateOrder })
            .from(containers)
            .where(eq(containers.userId, userId));

          const affectedContainers = allContainers.filter(
            (c) => Array.isArray(c.templateOrder) && c.templateOrder.includes(id)
          );

          if (affectedContainers.length > 0) {
            const containerIds = affectedContainers.map((c) => c.id);
            const videos = await db
              .select({ id: youtubeVideos.id })
              .from(youtubeVideos)
              .where(inArray(youtubeVideos.containerId, containerIds));

            if (videos.length > 0) {
              await inngestClient.send({
                name: "youtube/videos.update",
                data: { videoIds: videos.map((v) => v.id), userId },
              });
            }
          }
        }

        return mcpJson({ ...template, variables: parseVariables(template.content) });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to update template", "Try again later");
      }
    }
  );

  server.tool(
    "delete_template",
    "Delete a template",
    { id: z.string().describe("Template UUID") },
    async ({ id }) => {
      try {
        const result = await db
          .delete(templates)
          .where(and(eq(templates.id, id), eq(templates.userId, userId)))
          .returning({ id: templates.id });

        if (result.length === 0) {
          return mcpError("TEMPLATE_NOT_FOUND", "Template not found", "Check the template ID");
        }

        return mcpJson({ success: true });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to delete template", "Try again later");
      }
    }
  );

  server.tool(
    "get_template_impact",
    "Show which containers and videos would be affected by changing a template",
    { id: z.string().describe("Template UUID") },
    async ({ id }) => {
      try {
        const [template] = await db
          .select({ id: templates.id })
          .from(templates)
          .where(and(eq(templates.id, id), eq(templates.userId, userId)));

        if (!template) {
          return mcpError("TEMPLATE_NOT_FOUND", "Template not found", "Check the template ID");
        }

        const allContainers = await db
          .select({ id: containers.id, name: containers.name, templateOrder: containers.templateOrder })
          .from(containers)
          .where(eq(containers.userId, userId));

        const affectedContainers = allContainers.filter(
          (c) => Array.isArray(c.templateOrder) && c.templateOrder.includes(id)
        );

        if (affectedContainers.length === 0) {
          return mcpJson({ containers: [], videos: [], count: 0 });
        }

        const containerIds = affectedContainers.map((c) => c.id);
        const videos = await db
          .select({
            id: youtubeVideos.id,
            title: youtubeVideos.title,
            videoId: youtubeVideos.videoId,
            containerId: youtubeVideos.containerId,
          })
          .from(youtubeVideos)
          .where(inArray(youtubeVideos.containerId, containerIds))
          .orderBy(asc(youtubeVideos.title));

        const containerInfo = affectedContainers.map((c) => ({
          id: c.id,
          name: c.name,
          videoCount: videos.filter((v) => v.containerId === c.id).length,
        }));

        return mcpJson({ containers: containerInfo, videos, count: videos.length });
      } catch {
        return mcpError("INTERNAL_ERROR", "Failed to fetch template impact", "Try again later");
      }
    }
  );
}
