import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/db";
import { apiRequestLog } from "@/db/schema";

const sessionStore = new AsyncLocalStorage<{ userId: string }>();

export { sessionStore };

export function getSessionUserId(): string {
  const session = sessionStore.getStore();
  if (!session) throw new Error("No MCP session available");
  return session.userId;
}

/**
 * Wraps data as MCP tool result content.
 */
export function mcpJson(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

/** Tool annotations for Claude Desktop permission grouping. */
export const READ = { readOnlyHint: true, destructiveHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false } as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;

/**
 * Returns an MCP error result matching the REST API error shape.
 */
/**
 * Logs an MCP tool request to the apiRequestLog table (fire-and-forget).
 */
export function logMcpRequest(
  userId: string,
  toolName: string,
  quotaUnits: number,
  statusCode: number
): void {
  db.insert(apiRequestLog)
    .values({
      apiKeyId: null,
      userId,
      endpoint: toolName,
      method: "MCP",
      statusCode,
      quotaUnits,
      source: "mcp",
    })
    .then(() => {})
    .catch((err) => console.error("Failed to log MCP request:", err));
}

export function mcpError(code: string, message: string, suggestion?: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { error: { code, message, suggestion } },
          null,
          2
        ),
      },
    ],
  };
}
