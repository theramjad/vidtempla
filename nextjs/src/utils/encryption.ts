/**
 * Encryption utilities for securely storing OAuth tokens
 * Uses AES-256-GCM for encryption with per-record scrypt-derived keys.
 *
 * Ciphertext layout (unchanged from legacy): salt(64) + iv(16) + tag(16) + encrypted
 *
 * Two key-derivation schemes coexist on read so that legacy blobs in
 * production remain decryptable:
 *
 *   - NEW (writes): masterKey = sha256(rawKey); aesKey = scrypt(masterKey, salt, 32).
 *     Salt is load-bearing — it actually feeds the KDF, so two records encrypted
 *     with the same master key produce independent AES keys.
 *
 *   - LEGACY (reads only): aesKey = rawKey padded with ASCII '0' / truncated to
 *     32 bytes. Salt was generated and stored but never fed into a KDF. Kept for
 *     backwards compatibility with rows written before this change.
 *
 * On decrypt we try the NEW scheme first. AES-GCM tag verification will throw if
 * the key is wrong, at which point we fall back to LEGACY. If both fail, we
 * re-throw the original (NEW-scheme) error.
 *
 * Round-trip example (NEW scheme):
 *
 *   const blob = encrypt('hello', 'some-master-key');
 *   decrypt(blob, 'some-master-key'); // → 'hello'
 *
 * Legacy-decrypt example (verifies backwards compatibility):
 *
 *   // A blob written by the pre-fix code path can still be decrypted:
 *   const legacyBlob = encryptLegacyForTests('hello', 'some-master-key');
 *   decrypt(legacyBlob, 'some-master-key'); // → 'hello'
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;
const MIN_CIPHERTEXT_LENGTH = ENCRYPTED_POSITION;

const KEY_LENGTH = 32; // AES-256
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/**
 * NEW scheme: hash the raw key with SHA-256 to get a deterministic 32-byte
 * master key. No silent collisions from padding/truncation.
 */
function deriveMasterKey(rawKey: string): Buffer {
  return createHash('sha256').update(rawKey, 'utf-8').digest();
}

/**
 * NEW scheme: derive a per-record AES key from the master key and the
 * record's salt using scrypt. The salt is now cryptographically load-bearing.
 */
function deriveAesKey(masterKey: Buffer, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH, SCRYPT_PARAMS);
}

/**
 * LEGACY scheme: pre-fix key derivation. Pads short keys with ASCII '0' and
 * silently truncates long ones. Retained ONLY so that ciphertexts written
 * before the fix remain decryptable. Never used for new writes.
 */
function legacyNormalizeKey(rawKey: string): Buffer {
  return Buffer.from(rawKey.padEnd(32, '0').substring(0, 32), 'utf-8');
}

function resolveRawKey(rawKey?: string): string {
  const key = rawKey ?? process.env.ENCRYPTION_KEY_V2;
  if (!key) {
    throw new Error('ENCRYPTION_KEY_V2 environment variable is not set');
  }
  return key;
}

/**
 * Encrypts text using AES-256-GCM with a per-record scrypt-derived key.
 * @param text - The text to encrypt
 * @param rawKey - Optional key override (defaults to process.env.ENCRYPTION_KEY_V2)
 * @returns Base64 encoded encrypted string with salt, IV, and auth tag
 */
export function encrypt(text: string, rawKey?: string): string {
  const masterKey = deriveMasterKey(resolveRawKey(rawKey));
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const aesKey = deriveAesKey(masterKey, salt);

  const cipher = createCipheriv(ALGORITHM, aesKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Layout: salt + iv + tag + encrypted (unchanged for backwards compat).
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts text that was encrypted with encrypt() — including legacy blobs
 * written before the salt-as-KDF-input fix.
 *
 * Tries the NEW scheme first; on AES-GCM tag failure, falls back to the
 * LEGACY scheme. If neither succeeds, re-throws the NEW-scheme error.
 *
 * @param encryptedText - Base64 encoded encrypted string
 * @param rawKey - Optional key override (defaults to process.env.ENCRYPTION_KEY_V2)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string, rawKey?: string): string {
  const raw = resolveRawKey(rawKey);
  const combined = Buffer.from(encryptedText, 'base64');

  if (combined.length < MIN_CIPHERTEXT_LENGTH) {
    throw new Error('Encrypted payload is too short');
  }

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = combined.subarray(ENCRYPTED_POSITION);

  // Attempt NEW scheme: scrypt(sha256(rawKey), salt, 32).
  try {
    const aesKey = deriveAesKey(deriveMasterKey(raw), salt);
    return decryptWithAesKey(aesKey, iv, tag, encrypted);
  } catch (newSchemeErr) {
    // Fall back to LEGACY scheme: normalizeKey(rawKey) (pad/truncate, salt unused).
    try {
      const legacyKey = legacyNormalizeKey(raw);
      return decryptWithAesKey(legacyKey, iv, tag, encrypted);
    } catch {
      // Surface the new-scheme error; that's what callers will hit going forward.
      throw newSchemeErr;
    }
  }
}

function decryptWithAesKey(
  aesKey: Buffer,
  iv: Buffer,
  tag: Buffer,
  encrypted: Buffer,
): string {
  const decipher = createDecipheriv(ALGORITHM, aesKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
