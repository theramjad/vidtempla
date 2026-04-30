/**
 * Encryption utilities for securely storing OAuth tokens.
 * Uses AES-256-GCM.
 *
 * --------------------------------------------------------------------------
 * Versioned ciphertext layout
 * --------------------------------------------------------------------------
 * New ciphertexts produced by `encrypt()` are base64 of:
 *
 *   [version (1 byte)] [salt (64 bytes)] [iv (16 bytes)] [tag (16 bytes)] [ct]
 *
 * The leading byte selects which raw key in `KEYS` was used. New writes use
 * the PR #48 KDF scheme: masterKey = sha256(rawKey), then
 * aesKey = scrypt(masterKey, salt, 32).
 *
 * Legacy ciphertexts (written before this change) have NO version prefix and
 * begin directly with the salt. To stay backwards-compatible, `decrypt()`
 * peeks at the first byte: if it matches a known version in the keyring it
 * is consumed as a version marker, otherwise the buffer is treated as a
 * legacy blob and decrypted with `ENCRYPTION_KEY_V2`. The legacy path accepts
 * both PR #48 unversioned KDF ciphertext and older pre-KDF ciphertext.
 *
 * Version-byte → env-var mapping:
 *   0x02 → ENCRYPTION_KEY_V2 (currently active)
 *   0x03 → ENCRYPTION_KEY_V3 (reserved; activate during rotation)
 *
 * Rotation playbook:
 *   1. Deploy with both ENCRYPTION_KEY_V2 and ENCRYPTION_KEY_V3 set.
 *   2. Bump ACTIVE_VERSION below to 0x03 and redeploy. New writes are tagged
 *      v3; v2 reads continue to work via the keyring.
 *   3. Lazily re-encrypt old blobs on read-modify cycles (or run a backfill).
 *   4. Once all stored blobs are v3 (or older blobs are tolerable to lose),
 *      remove ENCRYPTION_KEY_V2 from the environment and drop 0x02 from KEYS.
 * --------------------------------------------------------------------------
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;
const KEY_LENGTH = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/**
 * Map of version byte → raw key string (from env). Add a new entry here when
 * introducing a future rotation (e.g. 0x04 → ENCRYPTION_KEY_V4).
 */
const KEYS: Record<number, string | undefined> = {
  0x02: process.env.ENCRYPTION_KEY_V2, // required
  0x03: process.env.ENCRYPTION_KEY_V3, // optional; activate when rotating
};

/**
 * The version that `encrypt()` will tag onto new ciphertexts. Bump this to
 * 0x03 (and ensure ENCRYPTION_KEY_V3 is set in every environment) to begin
 * writing v3 blobs.
 */
const ACTIVE_VERSION = 0x02;

function deriveMasterKey(rawKey: string): Buffer {
  return createHash("sha256").update(rawKey, "utf-8").digest();
}

function deriveAesKey(masterKey: Buffer, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH, SCRYPT_PARAMS);
}

function legacyNormalizeKey(rawKey: string): Buffer {
  // Pre-KDF compatibility path: pad/truncate to 32 bytes.
  return Buffer.from(rawKey.padEnd(32, "0").substring(0, 32), "utf-8");
}

function getRawKeyForVersion(version: number): string {
  const raw = KEYS[version];
  if (!raw) {
    throw new Error(
      `Encryption key for version 0x${version.toString(16).padStart(2, "0")} is not set`,
    );
  }
  return raw;
}

function encryptWithRawKey(plaintext: string, rawKey: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveAesKey(deriveMasterKey(rawKey), salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // salt + iv + tag + encrypted (no version byte; caller prepends it)
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decryptComponentsWithKey(
  key: Buffer,
  iv: Buffer,
  tag: Buffer,
  encrypted: Buffer,
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function decryptWithRawKey(packed: Buffer, rawKey: string): string {
  if (packed.length < ENCRYPTED_POSITION) {
    throw new Error("Ciphertext is too short to decrypt");
  }
  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = packed.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = packed.subarray(ENCRYPTED_POSITION);

  try {
    const key = deriveAesKey(deriveMasterKey(rawKey), salt);
    return decryptComponentsWithKey(key, iv, tag, encrypted);
  } catch (newSchemeError) {
    try {
      return decryptComponentsWithKey(
        legacyNormalizeKey(rawKey),
        iv,
        tag,
        encrypted,
      );
    } catch {
      throw newSchemeError;
    }
  }
}

function getKnownVersionPrefix(buf: Buffer): number | undefined {
  const possibleVersion = buf[0];
  if (
    typeof possibleVersion === "number" &&
    Object.prototype.hasOwnProperty.call(KEYS, possibleVersion)
  ) {
    return possibleVersion;
  }
  return undefined;
}

/**
 * Encrypts text using AES-256-GCM with the currently-active key. The output
 * is a base64 string whose first byte (after decoding) identifies the key
 * version, allowing `decrypt()` to route to the correct key.
 *
 * @param text - The text to encrypt
 * @param rawKey - Optional raw key override. When provided, the resulting
 *                 ciphertext is tagged with ACTIVE_VERSION but encrypted with
 *                 the override key. Useful in tests; not recommended in
 *                 production code paths.
 * @returns Base64 encoded `version | salt | iv | tag | encrypted`
 */
export function encrypt(text: string, rawKey?: string): string {
  const key = rawKey ?? getRawKeyForVersion(ACTIVE_VERSION);
  const packed = encryptWithRawKey(text, key);
  const versioned = Buffer.concat([Buffer.from([ACTIVE_VERSION]), packed]);
  return versioned.toString("base64");
}

/**
 * Decrypts text previously produced by `encrypt()`.
 *
 * Routing:
 *   - If the first decoded byte matches a key in the keyring, it is treated
 *     as the version marker and the corresponding key is used.
 *   - Otherwise the blob is assumed to be legacy (no version prefix) and is
 *     decrypted with ENCRYPTION_KEY_V2.
 *
 * @param encryptedText - Base64 encoded ciphertext
 * @param rawKey - Optional raw key override. When set, this key is used
 *                 directly. Versioned layout is tried first when a known
 *                 version prefix exists, then legacy layout is tried for
 *                 backwards compatibility with old test/tool ciphertexts.
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string, rawKey?: string): string {
  const buf = Buffer.from(encryptedText, "base64");
  if (buf.length === 0) {
    throw new Error("Cannot decrypt empty ciphertext");
  }

  if (rawKey) {
    if (getKnownVersionPrefix(buf) !== undefined) {
      try {
        return decryptWithRawKey(buf.subarray(1), rawKey);
      } catch (versionedError) {
        // Legacy raw-key ciphertexts can start with a byte that looks like a
        // version marker because that byte used to be random salt.
        try {
          return decryptWithRawKey(buf, rawKey);
        } catch {
          throw versionedError;
        }
      }
    }
    return decryptWithRawKey(buf, rawKey);
  }

  // If the first byte is a known version marker, peel it off and route.
  // Edge case: a legacy ciphertext's random salt byte has a 1/256 chance of
  // colliding with a known version marker. In that (rare) case the versioned
  // decrypt will throw a GCM auth error; we fall back to the legacy layout
  // and try again. New ciphertexts are well-formed under the versioned path,
  // so the fallback is dead code for them.
  const possibleVersion = getKnownVersionPrefix(buf);
  if (possibleVersion !== undefined && KEYS[possibleVersion]) {
    try {
      const key = getRawKeyForVersion(possibleVersion);
      return decryptWithRawKey(buf.subarray(1), key);
    } catch (versionedError) {
      // Fall through to the legacy path below. If the legacy path also fails,
      // surface the versioned failure because tagged blobs should be read that way.
      const legacyKey = KEYS[0x02];
      if (!legacyKey) {
        throw versionedError;
      }
      try {
        return decryptWithRawKey(buf, legacyKey);
      } catch {
        throw versionedError;
      }
    }
  }

  // Legacy path: no version prefix; decrypt with V2.
  const legacyKey = KEYS[0x02];
  if (!legacyKey) {
    throw new Error(
      "Cannot decrypt legacy ciphertext: ENCRYPTION_KEY_V2 is not set",
    );
  }
  return decryptWithRawKey(buf, legacyKey);
}
