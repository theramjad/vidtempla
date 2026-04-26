# 21: `ENCRYPTION_KEY_V2` is cosmetic — no rotation path

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/env/schema.mjs:18` — requires `ENCRYPTION_KEY_V2`
- `nextjs/src/utils/encryption.ts:21` — reads it directly
- Recent commit `ce18317`: removed rotation endpoint (renamed `_V2`)

## Bug
The `_V2` suffix is naming-only. Ciphertext format is `salt + iv + tag + encrypted` with no version selector byte. The system can't read a record encrypted with one key while writing with another.

## Impact
Key rotation requires:
1. Decrypt every encrypted blob with the old key offline
2. Re-encrypt with the new key
3. Deploy
Multi-second downtime, irreversible if anything fails midway. In practice, the key never gets rotated.

## Fix
Prefix every ciphertext with a version marker; resolve via a keyring:

```ts
const KEYS = {
  v3: process.env.ENCRYPTION_KEY_V3,  // active write key
  v2: process.env.ENCRYPTION_KEY_V2,  // legacy, read-only during rotation
};
const ACTIVE = 'v3';

function encrypt(plaintext: string): string {
  // ... existing logic with KEYS[ACTIVE]
  return `${ACTIVE}:${packed.toString('base64')}`;
}

function decrypt(ciphertext: string): string {
  const [version, payload] = ciphertext.split(':', 2);
  const key = KEYS[version];
  if (!key) throw new Error(`Unknown encryption key version: ${version}`);
  // ... decrypt using `key`
}
```

Rotation playbook: deploy with both keys set, slowly re-encrypt records on read-modify cycles, drop old key when usage drops to zero.

## Related
- #20 (must land first — proper KDF use is a prerequisite)
