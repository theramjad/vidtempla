import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, READ, WRITE, DESTRUCTIVE } from "../helpers";
import {
  listContainers,
  getContainer,
  createContainer,
  updateContainer,
  deleteContainer,
} from "@/lib/services/containers";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

export function registerContainerTools(server: McpServer) {
  server.tool(
    "list_containers",
    "List all containers with video counts",
    {
      cursor: z.string().optional().describe("Pagination cursor"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    READ,
    async (args) => toMcp(await listContainers(getSessionUserId(), args))
  );

  server.tool(
    "get_container",
    "Get container details with ordered templates",
    { id: z.string().describe("Container UUID") },
    READ,
    async ({ id }) => toMcp(await getContainer(id, getSessionUserId()))
  );

  server.tool(
    "create_container",
    "Create a container that links templates together",
    {
      name: z.string().describe("Container name"),
      templateIds: z.array(z.string()).describe("Ordered array of template UUIDs"),
      separator: z.string().optional().describe("Text between templates (default: two newlines)"),
    },
    WRITE,
    async ({ name, templateIds, separator }) => toMcp(await createContainer(getSessionUserId(), name, templateIds, separator))
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
    WRITE,
    async ({ id, name, templateIds, separator }) => toMcp(await updateContainer(id, getSessionUserId(), { name, templateIds, separator }))
  );

  server.tool(
    "delete_container",
    "Delete a container. Videos will be unassigned.",
    { id: z.string().describe("Container UUID") },
    DESTRUCTIVE,
    async ({ id }) => toMcp(await deleteContainer(id, getSessionUserId()))
  );
}
