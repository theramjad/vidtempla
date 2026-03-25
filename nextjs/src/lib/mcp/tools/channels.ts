import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError } from "../helpers";
import {
  listChannels,
  getChannel,
  getChannelOverview,
} from "@/lib/services/channels";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

export function registerChannelTools(server: McpServer, userId: string) {
  server.tool(
    "list_channels",
    "List all connected YouTube channels",
    {},
    async () => toMcp(await listChannels(userId))
  );

  server.tool(
    "get_channel",
    "Get real-time YouTube channel details (costs 1 YouTube API quota unit)",
    { channelId: z.string().describe("YouTube channel ID (e.g. UCxxxxxx)") },
    async ({ channelId }) => toMcp(await getChannel(channelId, userId))
  );

  server.tool(
    "get_channel_overview",
    "Get channel overview with templates, containers, video counts, and description health (costs 1 YouTube API quota unit)",
    { channelId: z.string().describe("YouTube channel ID") },
    async ({ channelId }) => toMcp(await getChannelOverview(channelId, userId))
  );
}
