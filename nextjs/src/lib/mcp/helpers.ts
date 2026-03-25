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

/**
 * Returns an MCP error result matching the REST API error shape.
 */
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
