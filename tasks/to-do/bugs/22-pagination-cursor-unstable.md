# 22: Pagination cursors unstable on duplicate timestamps

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/templates.ts:18, 30` — `lt(createdAt, cursor)` with no id tiebreaker
- `nextjs/src/lib/services/videos.ts:268-303` — same with `publishedAt`
- **Reference (correct pattern):** `nextjs/src/server/api/routers/dashboard/apiKeys.ts:289-294, 321` — composite `(createdAt, id)`

## Bug
Single-column `lt(createdAt, cursor)`. Bulk inserts (sync, import) can share a timestamp at the millisecond. The cursor then either skips rows (if predicate is strict `<`) or repeats them (if `<=`). Pagination gaps are silent.

**Codex sub-bug:** When videos are sorted by `title`, the cursor must include `title|id`, not `publishedAt|id`. Sort-key ↔ cursor-key mismatch is its own correctness bug — verify all sort options have matching cursor encodings.

## Fix
Copy the apiKeys pattern. Cursor encodes both columns; predicate uses `OR`:

```ts
const cursor = items.at(-1) ? `${items.at(-1)!.createdAt.toISOString()}|${items.at(-1)!.id}` : null;

// Decode and apply:
const [cursorDate, cursorId] = cursor.split('|');
const where = or(
  lt(templates.createdAt, new Date(cursorDate)),
  and(eq(templates.createdAt, new Date(cursorDate)), lt(templates.id, cursorId)),
);
```

For each sort mode, use a cursor matching that sort key.
