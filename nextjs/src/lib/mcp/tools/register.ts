import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChannelTools } from "./channels";
import { registerVideoTools } from "./videos";
import { registerTemplateTools } from "./templates";
import { registerContainerTools } from "./containers";
import { registerAnalyticsTools } from "./analytics";

/**
 * Registers all MCP tools on the server.
 * userId comes from the Better Auth OAuth session.
 */
export function registerAllTools(server: McpServer, userId: string) {
  registerChannelTools(server, userId);
  registerVideoTools(server, userId);
  registerTemplateTools(server, userId);
  registerContainerTools(server, userId);
  registerAnalyticsTools(server, userId);
}
