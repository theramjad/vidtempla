import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, logMcpRequest, READ, WRITE, DESTRUCTIVE } from "../helpers";
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
    async (args) => {
      const userId = getSessionUserId();
      const result = await listTemplates(userId, args);
      logMcpRequest(userId, "list_templates", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_template",
    "Get a single template by ID with parsed variables",
    { id: z.string().describe("Template UUID") },
    READ,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await getTemplate(id, userId);
      logMcpRequest(userId, "get_template", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "create_template",
    "Create a new template. Use {{variableName}} for placeholders.",
    {
      name: z.string().describe("Template name"),
      content: z.string().describe("Template content with {{variable}} placeholders"),
    },
    WRITE,
    async ({ name, content }) => {
      const userId = getSessionUserId();
      const result = await createTemplate(userId, name, content);
      logMcpRequest(userId, "create_template", 0, "error" in result ? 400 : 200);
      return toMcp(result);
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
    WRITE,
    async ({ id, name, content }) => {
      const userId = getSessionUserId();
      const result = await updateTemplate(id, userId, { name, content });
      logMcpRequest(userId, "update_template", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "delete_template",
    "Delete a template",
    { id: z.string().describe("Template UUID") },
    DESTRUCTIVE,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await deleteTemplate(id, userId);
      logMcpRequest(userId, "delete_template", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_template_impact",
    "Show which containers and videos would be affected by changing a template",
    { id: z.string().describe("Template UUID") },
    READ,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await getTemplateImpact(id, userId);
      logMcpRequest(userId, "get_template_impact", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
