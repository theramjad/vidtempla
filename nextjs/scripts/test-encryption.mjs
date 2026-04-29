import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';

import { decrypt, encrypt } from '../src/utils/encryption.ts';

const SALT_LENGTH = 64;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const TEST_KEY = '0123456789abcdef0123456789abcdef';

function legacyNormalizeKey(rawKey) {
  return Buffer.from(rawKey.padEnd(32, '0').substring(0, 32), 'utf-8');
}

function encryptLegacy(text, rawKey) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', legacyNormalizeKey(rawKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

test('new encryption round-trips through decrypt', () => {
  const ciphertext = encrypt('youtube-refresh-token', TEST_KEY);

  assert.equal(decrypt(ciphertext, TEST_KEY), 'youtube-refresh-token');
});

test('new encryption uses the stored salt as KDF input', () => {
  const ciphertext = encrypt('same plaintext', TEST_KEY);
  const combined = Buffer.from(ciphertext, 'base64');
  combined[0] ^= 0xff;

  assert.throws(() => decrypt(combined.toString('base64'), TEST_KEY));
});

test('legacy ciphertext remains decryptable', () => {
  const legacyCiphertext = encryptLegacy('legacy-refresh-token', TEST_KEY);

  assert.equal(decrypt(legacyCiphertext, TEST_KEY), 'legacy-refresh-token');
});

test('distinct raw keys no longer collide for new ciphertexts', () => {
  const keyA = `${'a'.repeat(32)}AAAA`;
  const keyB = `${'a'.repeat(32)}BBBB`;
  assert.equal(legacyNormalizeKey(keyA).equals(legacyNormalizeKey(keyB)), true);

  const ciphertext = encrypt('token', keyA);

  assert.throws(() => decrypt(ciphertext, keyB));
});

test('wrong key is rejected', () => {
  const ciphertext = encrypt('token', TEST_KEY);

  assert.throws(() => decrypt(ciphertext, 'wrong-key-0123456789abcdef0000'));
});

test('truncated payloads are rejected before AES-GCM tag handling', () => {
  const ciphertext = encrypt('', TEST_KEY);
  const truncated = Buffer.from(ciphertext, 'base64')
    .subarray(0, SALT_LENGTH + IV_LENGTH + 4)
    .toString('base64');

  assert.throws(() => decrypt(truncated, TEST_KEY), /too short/);
});
