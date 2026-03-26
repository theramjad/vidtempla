import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpJson, mcpError, getSessionUserId, logMcpRequest, READ } from "../helpers";
import { consumeCredits } from "@/lib/plan-limits";
import {
  listChannels,
  getChannel,
  getChannelOverview,
} from "@/lib/services/channels";

function toMcp(result: { data: unknown } | { error: { code: string; message: string; suggestion: string } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion);
  return mcpJson(result.data);
}

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
      if (!credits.success) {
        logMcpRequest(userId, "get_channel", 0, 429);
        return mcpError("QUOTA_EXCEEDED", "Insufficient credits", "Upgrade your plan or wait for the next billing cycle");
      }
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
      if (!credits.success) {
        logMcpRequest(userId, "get_channel_overview", 0, 429);
        return mcpError("QUOTA_EXCEEDED", "Insufficient credits", "Upgrade your plan or wait for the next billing cycle");
      }
      const result = await getChannelOverview(channelId, userId);
      logMcpRequest(userId, "get_channel_overview", 1, "error" in result ? 400 : 200);
      return toMcp(result);
    }
  );
}
