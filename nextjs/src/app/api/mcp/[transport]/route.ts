import { createMcpHandler } from "mcp-handler";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { registerAllTools } from "@/lib/mcp/tools/register";

const mcpHandler = withMcpAuth(auth, async (req, session) => {
  return createMcpHandler(
    (server) => {
      registerAllTools(server, session.userId);
    },
    { serverInfo: { name: "VidTempla", version: "1.0.0" } },
    { basePath: "/api/mcp", maxDuration: 60, disableSse: true }
  )(req);
});

async function handler(req: Request): Promise<Response> {
  try {
    const response = await mcpHandler(req);
    if (!response) {
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "No response from handler" }, id: null },
        { status: 500 }
      );
    }
    return response;
  } catch (error) {
    console.error("[MCP] Handler error:", error);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST, handler as DELETE };
