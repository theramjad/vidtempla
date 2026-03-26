import { createMcpHandler } from "mcp-handler";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { registerAllTools } from "@/lib/mcp/tools/register";
import { sessionStore } from "@/lib/mcp/helpers";
import { db } from "@/db";
import { oauthAccessToken } from "@/db/schema";
import { eq } from "drizzle-orm";

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

const HANDLER_TIMEOUT_MS = 55_000;

async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  console.log("[MCP-DEBUG] ===== NEW REQUEST =====");
  console.log("[MCP-DEBUG] Method:", req.method, "URL:", req.url);
  console.log("[MCP-DEBUG] Auth header present:", !!authHeader);
  console.log("[MCP-DEBUG] Auth header value:", authHeader ? authHeader.substring(0, 30) + "..." : "null");
  console.log("[MCP-DEBUG] Bearer token length:", bearerToken?.length ?? 0);

  // Direct DB lookup to see if token exists
  if (bearerToken) {
    try {
      const dbToken = await db.select().from(oauthAccessToken).where(eq(oauthAccessToken.accessToken, bearerToken)).limit(1);
      console.log("[MCP-DEBUG] DB token lookup: found", dbToken.length, "rows");
      if (dbToken.length > 0) {
        console.log("[MCP-DEBUG] Token userId:", dbToken[0].userId, "clientId:", dbToken[0].clientId, "scopes:", dbToken[0].scopes);
        console.log("[MCP-DEBUG] Token expiresAt:", dbToken[0].accessTokenExpiresAt);
        const now = new Date();
        const expired = dbToken[0].accessTokenExpiresAt && dbToken[0].accessTokenExpiresAt < now;
        console.log("[MCP-DEBUG] Token expired?", expired, "(now:", now.toISOString(), ")");
      }
    } catch (e) {
      console.error("[MCP-DEBUG] DB lookup error:", e);
    }

    // Also try getMcpSession
    try {
      const sessionCheck = await auth.api.getMcpSession({ headers: req.headers });
      console.log("[MCP-DEBUG] getMcpSession result:", sessionCheck ? JSON.stringify({ userId: sessionCheck.userId, session: !!sessionCheck.session }) : "null");
    } catch (e) {
      console.error("[MCP-DEBUG] getMcpSession threw:", e instanceof Error ? e.message : e);
    }
  }

  // Log all request headers for debugging
  const headerObj: Record<string, string> = {};
  req.headers.forEach((v, k) => { headerObj[k] = k.toLowerCase() === "authorization" ? v.substring(0, 30) + "..." : v.substring(0, 80); });
  console.log("[MCP-DEBUG] Headers:", JSON.stringify(headerObj));

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
    console.log("[MCP-DEBUG] Final response status:", response.status);
    if (response.status === 401) {
      const body = await response.clone().text();
      console.log("[MCP-DEBUG] 401 response body:", body.substring(0, 500));
    }
    return response;
  } catch (error) {
    console.error("[MCP-DEBUG] Handler error:", error);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: error instanceof Error ? error.message : "Internal server error" }, id: null },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST, handler as DELETE };
