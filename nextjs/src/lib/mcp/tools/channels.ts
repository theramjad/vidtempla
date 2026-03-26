import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toMcp, mcpQuotaExceeded, getSessionUserId, logMcpRequest, READ } from "../helpers";
import { consumeCredits } from "@/lib/plan-limits";
import {
  listChannels,
  getChannel,
  getChannelOverview,
} from "@/lib/services/channels";

export function registerChannelTools(server: McpServer) {
  server.tool(
    "list_channels",
    "List all connected YouTube channels",
    {},
    READ,
    async () => {
      const userId = getSessionUserId();
      const result = await listChannels(userId);
      logMcpRequest(userId, "list_channels", 0, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_channel",
    "Get real-time YouTube channel details (costs 1 YouTube API quota unit)",
    { channelId: z.string().describe("YouTube channel ID (e.g. UCxxxxxx)") },
    READ,
    async ({ channelId }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 1);
      if (!credits.success) return mcpQuotaExceeded(userId, "get_channel");
      const result = await getChannel(channelId, userId);
      logMcpRequest(userId, "get_channel", 1, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );

  server.tool(
    "get_channel_overview",
    "Get channel overview with templates, containers, video counts, and description health (costs 1 YouTube API quota unit)",
    { channelId: z.string().describe("YouTube channel ID") },
    READ,
    async ({ channelId }) => {
      const userId = getSessionUserId();
      const credits = await consumeCredits(userId, 1);
      if (!credits.success) return mcpQuotaExceeded(userId, "get_channel_overview");
      const result = await getChannelOverview(channelId, userId);
      logMcpRequest(userId, "get_channel_overview", 1, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
