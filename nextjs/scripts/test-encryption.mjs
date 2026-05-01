import assert from "node:assert/strict";
import {
  createCipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import test from "node:test";

process.env.ENCRYPTION_KEY_V2 = "v2-test-key-0123456789abcdef012345";
process.env.ENCRYPTION_KEY_V3 = "v3-test-key-0123456789abcdef012345";

const { decrypt, encrypt } = await import("../src/utils/encryption.ts");

const SALT_LENGTH = 64;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;
const TEST_KEY = "0123456789abcdef0123456789abcdef";

function legacyNormalizeKey(rawKey) {
  return Buffer.from(rawKey.padEnd(32, "0").substring(0, 32), "utf-8");
}

function deriveMasterKey(rawKey) {
  return createHash("sha256").update(rawKey, "utf-8").digest();
}

function deriveAesKey(rawKey, salt) {
  return scryptSync(deriveMasterKey(rawKey), salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

function encryptPacked(text, key, salt = randomBytes(SALT_LENGTH)) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]);
}

function encryptUnversionedKdf(text, rawKey, salt = randomBytes(SALT_LENGTH)) {
  return encryptPacked(text, deriveAesKey(rawKey, salt), salt).toString(
    "base64",
  );
}

function encryptUnversionedPreKdf(text, rawKey) {
  return encryptPacked(text, legacyNormalizeKey(rawKey)).toString("base64");
}

function encryptVersionedPreKdf(text, rawKey, version = 0x02) {
  return Buffer.concat([
    Buffer.from([version]),
    encryptPacked(text, legacyNormalizeKey(rawKey)),
  ]).toString("base64");
}

function encryptVersionedKdf(text, rawKey, version) {
  return Buffer.concat([
    Buffer.from([version]),
    Buffer.from(encryptUnversionedKdf(text, rawKey), "base64"),
  ]).toString("base64");
}

test("new versioned encryption round-trips through decrypt", () => {
  const ciphertext = encrypt("youtube-refresh-token", TEST_KEY);
  const decoded = Buffer.from(ciphertext, "base64");

  assert.equal(decoded[0], 0x02);
  assert.equal(decrypt(ciphertext, TEST_KEY), "youtube-refresh-token");
});

test("new versioned encryption uses the stored salt as KDF input", () => {
  const ciphertext = encrypt("same plaintext", TEST_KEY);
  const combined = Buffer.from(ciphertext, "base64");
  combined[1] ^= 0xff;

  assert.throws(() => decrypt(combined.toString("base64"), TEST_KEY));
});

test("unversioned KDF ciphertext from PR 48 remains decryptable", () => {
  const legacyCiphertext = encryptUnversionedKdf(
    "pr48-refresh-token",
    TEST_KEY,
  );

  assert.equal(decrypt(legacyCiphertext, TEST_KEY), "pr48-refresh-token");
});

test("pre-KDF legacy ciphertext remains decryptable", () => {
  const legacyCiphertext = encryptUnversionedPreKdf(
    "legacy-refresh-token",
    TEST_KEY,
  );

  assert.equal(decrypt(legacyCiphertext, TEST_KEY), "legacy-refresh-token");
});

test("unversioned ciphertext survives a salt byte version-prefix collision", () => {
  const salt = randomBytes(SALT_LENGTH);
  salt[0] = 0x02;
  const legacyCiphertext = encryptUnversionedKdf(
    "collision-refresh-token",
    TEST_KEY,
    salt,
  );

  assert.equal(decrypt(legacyCiphertext, TEST_KEY), "collision-refresh-token");
});

test("versioned V3 ciphertext routes to ENCRYPTION_KEY_V3", () => {
  const ciphertext = encryptVersionedKdf(
    "v3-refresh-token",
    process.env.ENCRYPTION_KEY_V3,
    0x03,
  );

  assert.equal(decrypt(ciphertext), "v3-refresh-token");
});

test("versioned pre-KDF ciphertext from earlier PR 65 remains decryptable", () => {
  const ciphertext = encryptVersionedPreKdf("old-v2-versioned-token", TEST_KEY);

  assert.equal(decrypt(ciphertext, TEST_KEY), "old-v2-versioned-token");
});

test("distinct raw keys no longer collide for new ciphertexts", () => {
  const keyA = `${"a".repeat(32)}AAAA`;
  const keyB = `${"a".repeat(32)}BBBB`;
  assert.equal(legacyNormalizeKey(keyA).equals(legacyNormalizeKey(keyB)), true);

  const ciphertext = encrypt("token", keyA);

  assert.throws(() => decrypt(ciphertext, keyB));
});

test("wrong key is rejected", () => {
  const ciphertext = encrypt("token", TEST_KEY);

  assert.throws(() => decrypt(ciphertext, "wrong-key-0123456789abcdef0000"));
});

test("truncated payloads are rejected before AES-GCM tag handling", () => {
  const ciphertext = encrypt("", TEST_KEY);
  const truncated = Buffer.from(ciphertext, "base64")
    .subarray(0, 1 + ENCRYPTED_POSITION - TAG_LENGTH + 4)
    .toString("base64");

  assert.throws(() => decrypt(truncated, TEST_KEY), /too short/);
});
