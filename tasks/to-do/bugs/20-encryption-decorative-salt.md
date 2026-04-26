# 20: Encryption salt is decorative; `normalizeKey` pads/truncates raw key

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/utils/encryption.ts:17` — `normalizeKey` pads with `'0'` ASCII / truncates
- `nextjs/src/utils/encryption.ts:37` — generates random `salt` per record
- `nextjs/src/utils/encryption.ts:48` — packs salt into ciphertext
- `nextjs/src/utils/encryption.ts:64` — decrypt slices the salt off and discards it

## Bug
1. **Salt isn't a salt:** generated, stored, but never fed into a KDF (PBKDF2/scrypt/HKDF/Argon2). Every record encrypted with the same raw key bytes.
2. **`normalizeKey` is dangerous:** `Buffer.from(rawKey.padEnd(32, '0').substring(0, 32), 'utf-8')`. Short keys padded with ASCII `0x30`, long keys silently truncated. Two distinct keys can normalize to the same bytes.

## Impact
- A misconfigured short `ENCRYPTION_KEY_V2` becomes guessable
- The salt provides zero cryptographic value
- Per-record key derivation is impossible (blocking #21 rotation)
- Two operators using different long key strings could collide

## Fix
1. **Hard requirement:** raw key must be exactly 32 bytes after a normalization that *errors* on the wrong length, not pad/truncate. Or hash any input through SHA-256 to get 32 bytes deterministically.
2. **Use the salt:** derive the per-record AES key with `scrypt(rawKey, salt, 32)` or HKDF. Then the stored salt is load-bearing.

```ts
import { scryptSync, randomBytes } from 'crypto';

function deriveKey(rawKey: string, salt: Buffer): Buffer {
  const masterKey = createHash('sha256').update(rawKey, 'utf-8').digest();
  return scryptSync(masterKey, salt, 32);
}
```

## Related
- #21 (key rotation — this fix is a prerequisite for proper rotation)
