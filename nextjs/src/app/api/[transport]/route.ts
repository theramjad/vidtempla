import { createMcpHandler } from "mcp-handler";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { registerAllTools } from "@/lib/mcp/tools/register";
import { sessionStore } from "@/lib/mcp/helpers";

// Create MCP handler once at module level (not per-request)
const mcpRouteHandler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  { serverInfo: { name: "VidTempla", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60, disableSse: true }
);

// Wrap with better-auth MCP OAuth, passing session via AsyncLocalStorage
const mcpHandler = withMcpAuth(auth, async (req, session) => {
  console.log("[MCP] Auth succeeded, userId:", session.userId);
  return sessionStore.run({ userId: session.userId }, () => mcpRouteHandler(req));
});

// Timeout to prevent mcp-handler from hanging forever when the inner
// async handler fails without calling writeHead.
const HANDLER_TIMEOUT_MS = 55_000; // 55s — below Vercel's 60s function limit

async function handler(req: Request): Promise<Response> {
  // Debug: log auth header presence and attempt manual session lookup
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  console.log("[MCP] Request:", req.method, new URL(req.url).pathname,
    "| Auth header present:", !!authHeader,
    "| Bearer token length:", bearerToken?.length ?? 0);

  if (bearerToken) {
    try {
      const sessionCheck = await auth.api.getMcpSession({ headers: req.headers });
      console.log("[MCP] getMcpSession result:", sessionCheck ? "found (userId: " + sessionCheck.userId + ")" : "null");
    } catch (e) {
      console.error("[MCP] getMcpSession threw:", e);
    }
  }

  try {
    const response = await Promise.race([
      mcpHandler(req),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MCP handler timed out")), HANDLER_TIMEOUT_MS)
      ),
    ]);
    if (!response) {
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "No response from handler" }, id: null },
        { status: 500 }
      );
    }
    console.log("[MCP] Response status:", response.status);
    return response;
  } catch (error) {
    console.error("[MCP] Handler error:", error);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: error instanceof Error ? error.message : "Internal server error" }, id: null },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST, handler as DELETE };
