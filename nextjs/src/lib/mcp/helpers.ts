import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/db";
import { apiRequestLog } from "@/db/schema";
import type { JsonValue } from "@/lib/services/types";

const sessionStore = new AsyncLocalStorage<{ userId: string; organizationId: string }>();

export { sessionStore };

export function getSessionUserId(): string {
  const session = sessionStore.getStore();
  if (!session) throw new Error("No MCP session available");
  return session.userId;
}

export function getSessionOrgId(): string {
  const session = sessionStore.getStore();
  if (!session) throw new Error("No MCP session available");
  return session.organizationId;
}

/**
 * Wraps data as MCP tool result content.
 */
export function mcpJson<T>(data: T) {
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
 * Logs an MCP tool request to the apiRequestLog table (fire-and-forget).
 */
export function logMcpRequest(
  userId: string,
  toolName: string,
  quotaUnits: number,
  statusCode: number
): void {
  const session = sessionStore.getStore();
  db.insert(apiRequestLog)
    .values({
      apiKeyId: null,
      userId,
      organizationId: session?.organizationId ?? null,
      endpoint: toolName,
      method: "MCP",
      statusCode,
      quotaUnits,
      source: "mcp",
    })
    .then(() => {})
    .catch((err) => console.error("Failed to log MCP request:", err));
}

/**
 * Converts a service result (data or error) to MCP tool result format.
 */
export function toMcp<T>(result: { data: T } | { error: { code: string; message: string; suggestion: string; meta?: Record<string, JsonValue> } }) {
  if ("error" in result) return mcpError(result.error.code, result.error.message, result.error.suggestion, result.error.meta);
  return mcpJson(result.data);
}

/**
 * Standard quota-exceeded response for MCP tools.
 */
export function mcpQuotaExceeded(userId: string, toolName: string) {
  logMcpRequest(userId, toolName, 0, 429);
  return mcpError("QUOTA_EXCEEDED", "Insufficient credits", "Upgrade your plan or wait for the next billing cycle");
}

export function mcpError(code: string, message: string, suggestion?: string, meta?: Record<string, JsonValue>) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { error: { code, message, suggestion, ...(meta ? { meta } : {}) } },
          null,
          2
        ),
      },
    ],
  };
}
