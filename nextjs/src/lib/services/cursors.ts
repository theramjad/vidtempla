const COMPOSITE_CURSOR_PREFIX = "v1:";

export interface CompositeCursorPayload {
  scope: string;
  sort?: string;
  dir?: "asc" | "desc";
  key: string | null;
  id: string;
}

export function encodeCompositeCursor(payload: CompositeCursorPayload): string {
  const json = JSON.stringify({ v: 1, ...payload });
  const encoded = Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
  return `${COMPOSITE_CURSOR_PREFIX}${encoded}`;
}

export function isEncodedCompositeCursor(cursor: string): boolean {
  return cursor.startsWith(COMPOSITE_CURSOR_PREFIX);
}

export function decodeCompositeCursor(cursor: string): CompositeCursorPayload | null {
  if (!isEncodedCompositeCursor(cursor)) return null;

  try {
    const encoded = cursor.slice(COMPOSITE_CURSOR_PREFIX.length);
    const padded = encoded.padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
    const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as Partial<CompositeCursorPayload> & { v?: unknown };

    if (
      payload.v !== 1 ||
      typeof payload.scope !== "string" ||
      !payload.scope ||
      typeof payload.id !== "string" ||
      !payload.id ||
      (typeof payload.key !== "string" && payload.key !== null)
    ) {
      return null;
    }

    if (payload.sort !== undefined && typeof payload.sort !== "string") return null;
    if (payload.dir !== undefined && payload.dir !== "asc" && payload.dir !== "desc") return null;

    return {
      scope: payload.scope,
      sort: payload.sort,
      dir: payload.dir,
      key: payload.key,
      id: payload.id,
    };
  } catch {
    return null;
  }
}
