import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toMcp, getSessionUserId, logMcpRequest, READ, WRITE, DESTRUCTIVE } from "../helpers";
import {
  listContainers,
  getContainer,
  createContainer,
  updateContainer,
  deleteContainer,
} from "@/lib/services/containers";

export function registerContainerTools(server: McpServer) {
  server.tool(
    "list_containers",
    "List all containers with video counts",
    {
      cursor: z.string().optional().describe("Pagination cursor"),
      limit: z.number().optional().describe("Results per page (max 100, default 50)"),
    },
    READ,
    async (args) => {
      const userId = getSessionUserId();
      const result = await listContainers(userId, args);
      logMcpRequest(userId, "list_containers", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_container",
    "Get container details with ordered templates",
    { id: z.string().describe("Container UUID") },
    READ,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await getContainer(id, userId);
      logMcpRequest(userId, "get_container", 0, "error" in result ? 400 : 200);
      return toMcp(result);
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
    WRITE,
    async ({ name, templateIds, separator }) => {
      const userId = getSessionUserId();
      const result = await createContainer(userId, name, templateIds, separator);
      logMcpRequest(userId, "create_container", 0, "error" in result ? 400 : 200);
      return toMcp(result);
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
    WRITE,
    async ({ id, name, templateIds, separator }) => {
      const userId = getSessionUserId();
      const result = await updateContainer(id, userId, { name, templateIds, separator });
      logMcpRequest(userId, "update_container", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "delete_container",
    "Delete a container. Videos will be unassigned.",
    { id: z.string().describe("Container UUID") },
    DESTRUCTIVE,
    async ({ id }) => {
      const userId = getSessionUserId();
      const result = await deleteContainer(id, userId);
      logMcpRequest(userId, "delete_container", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
