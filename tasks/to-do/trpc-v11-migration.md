# tRPC v11 Migration

Bump `@trpc/*` from v10 to v11 and `@tanstack/react-query` from v4 to v5.

## Changes
1. Update `package.json` — bump all `@trpc/*` to v11, `@tanstack/react-query` to v5
2. Update `src/utils/api.ts` — move transformer from `createTRPCNext` config to the link chain
3. Verify `isLoading` usage still works (it does in RQ v5, no mass rename needed)
4. Run full build + smoke test
