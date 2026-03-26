# Post-Implementation Cleanup

Cleanup of the credit system / MCP logging / audit log feature (cd08a06).

## Completed

- **P0**: Fixed broken deploy — moved `quotaUnits` declaration out of `try` block scope in transcript route
- **Fix 1**: Extracted `toMcp()` to `helpers.ts`, removed from 6 MCP tool files
- **Fix 2**: Extracted `mcpQuotaExceeded()` helper, replaced 6 inline occurrences
- **Fix 3**: `getCreditBalance` tRPC procedure now calls `getCredits()` instead of duplicating query
- **Fix 4**: Extracted `upsertCredits()` helper in plan-limits.ts, used in stripe webhook + consumeCredits
- **Fix 5**: Composite `createdAt|id` cursor in `getRequestHistory` to avoid timestamp collisions
- **Fix 6**: Parallelized 4 queries in `getDetailedUsage` with `Promise.all`
- **Fix 7**: Changed `remaining: -1` sentinel to `remaining: Infinity`
