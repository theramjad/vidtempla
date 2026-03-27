import { createMcpHandler } from "mcp-handler";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { registerAllTools } from "@/lib/mcp/tools/register";
import { sessionStore } from "@/lib/mcp/helpers";
import { db } from "@/db";
import { member, session as sessionTable } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

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

  // Resolve user's organization for MCP context
  // Prefer activeOrganizationId from the user's most recent session, fallback to oldest membership
  let organizationId: string | undefined;

  const [latestSession] = await db
    .select({ activeOrganizationId: sessionTable.activeOrganizationId })
    .from(sessionTable)
    .where(eq(sessionTable.userId, session.userId))
    .orderBy(desc(sessionTable.updatedAt))
    .limit(1);

  if (latestSession?.activeOrganizationId) {
    organizationId = latestSession.activeOrganizationId;
  }

  if (!organizationId) {
    const [membership] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.userId))
      .orderBy(asc(member.createdAt))
      .limit(1);
    organizationId = membership?.organizationId;
  }

  if (!organizationId) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "No organization found for user" }, id: null },
      { status: 403 }
    );
  }

  return sessionStore.run({ userId: session.userId, organizationId }, () => mcpRouteHandler(req));
});

const HANDLER_TIMEOUT_MS = 55_000;

async function handler(req: Request): Promise<Response> {
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
