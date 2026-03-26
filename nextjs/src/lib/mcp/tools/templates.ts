import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, READ, WRITE, DESTRUCTIVE } from "../helpers";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateImpact,
} from "@/lib/services/templates";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

export function registerTemplateTools(server: McpServer) {
  server.tool(
    "list_templates",
    "List all templates with parsed variables",
    {
      cursor: z.string().optional().describe("Pagination cursor"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    READ,
    async (args) => toMcp(await listTemplates(getSessionUserId(), args))
  );

  server.tool(
    "get_template",
    "Get a single template by ID with parsed variables",
    { id: z.string().describe("Template UUID") },
    READ,
    async ({ id }) => toMcp(await getTemplate(id, getSessionUserId()))
  );

  server.tool(
    "create_template",
    "Create a new template. Use {{variableName}} for placeholders.",
    {
      name: z.string().describe("Template name"),
      content: z.string().describe("Template content with {{variable}} placeholders"),
    },
    WRITE,
    async ({ name, content }) => toMcp(await createTemplate(getSessionUserId(), name, content))
  );

  server.tool(
    "update_template",
    "Update a template's name and/or content. If content changes, affected video descriptions are rebuilt.",
    {
      id: z.string().describe("Template UUID"),
      name: z.string().optional().describe("New name"),
      content: z.string().optional().describe("New content"),
    },
    WRITE,
    async ({ id, name, content }) => toMcp(await updateTemplate(id, getSessionUserId(), { name, content }))
  );

  server.tool(
    "delete_template",
    "Delete a template",
    { id: z.string().describe("Template UUID") },
    DESTRUCTIVE,
    async ({ id }) => toMcp(await deleteTemplate(id, getSessionUserId()))
  );

  server.tool(
    "get_template_impact",
    "Show which containers and videos would be affected by changing a template",
    { id: z.string().describe("Template UUID") },
    READ,
    async ({ id }) => toMcp(await getTemplateImpact(id, getSessionUserId()))
  );
}
