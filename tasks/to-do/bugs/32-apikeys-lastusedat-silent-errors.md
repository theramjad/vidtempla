# 32: `apiKeys.lastUsedAt` errors silently swallowed (no observability)

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ⚠️ partial · Claude verifier ⚠️ partial · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/api-auth.ts:82-86`

## Bug
```ts
db.update(apiKeys).set({ lastUsedAt: new Date() })
  .where(eq(apiKeys.id, key.id))
  .then(() => {})
  .catch(() => {});  // silently swallows
```

## Impact
Real impact is silent failure (no observability), not unhandled rejection. If the update ever starts failing (PlanetScale outage, schema change, etc.) nobody finds out — `lastUsedAt` just stops advancing.

## Fix (trivial)
```diff
  .then(() => {})
- .catch(() => {});
+ .catch((err) => console.error("Failed to update API key lastUsedAt:", err));
```

Better: send to whatever error tracker is wired up (Sentry, etc.) if one exists.
