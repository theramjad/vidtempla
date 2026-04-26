# 14: `apiKeys.keyHash` has no unique constraint and no index

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/db/schema.ts:448` — `keyHash: text("key_hash").notNull()` only
- `nextjs/src/lib/api-auth.ts:52-55` — lookup does `where(eq(keyHash, ...))` and destructures `[key]`

## Bug
No `.unique()`, no `uniqueIndex`, no plain `index` on `keyHash`. Auth path destructures the first row.

## Impact
- **Performance:** sequential scan on every authenticated REST call
- **Correctness:** any duplicate hash (collision or buggy migration) silently picks an arbitrary row → nondeterministic auth

## Fix
Add a unique index, clean any duplicates first:

```ts
// schema.ts
keyHash: text("key_hash").notNull(),
// in the table's index block:
keyHashUnique: uniqueIndex("api_keys_key_hash_unique").on(t.keyHash),
```

Pre-migration: `SELECT key_hash, COUNT(*) FROM api_keys GROUP BY key_hash HAVING COUNT(*) > 1` — resolve any duplicates before adding the unique index, otherwise the migration will fail.
