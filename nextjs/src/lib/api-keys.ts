import { randomBytes, createHash } from "crypto";

const API_KEY_PREFIX = "vtk_";

/**
 * Hashes an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generates a new API key with prefix, hash, and plaintext
 * The plaintext is shown once to the user and never stored
 */
export function generateApiKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const rawKey = randomBytes(32).toString("hex");
  const plaintext = `${API_KEY_PREFIX}${rawKey}`;
  const hash = hashApiKey(plaintext);
  const prefix = `${API_KEY_PREFIX}${rawKey.slice(0, 4)}`;

  return { plaintext, hash, prefix };
}
