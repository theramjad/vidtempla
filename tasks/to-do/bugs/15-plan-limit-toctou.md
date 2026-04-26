# 15: Plan-limit check (`checkVideoLimit`) outside the assignment transaction

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/services/videos.ts:572-577` — count + `checkVideoLimit` (outside txn)
- `nextjs/src/lib/services/videos.ts:644` — txn opens
- Same pattern in channel-connect callback at `pages/api/auth/youtube/callback.ts:113-138`

## Bug
The `assignedCount` query and `checkVideoLimit(...)` run on `db` outside any transaction. The mutating txn doesn't begin until later. Two concurrent `assignVideo` calls at limit-1 both pass the check, both reach the txn, both succeed — exceeding the plan cap.

## Impact
Users on tight plan caps can exceed their limit by issuing concurrent assigns (or by an agent batch-assigning). Quietly inflates usage / bypasses billing tier.

## Fix
Move the count + insert into one `SERIALIZABLE` (or row-locked) transaction. Re-count inside the txn after acquiring an org-level lock:

```ts
await db.transaction(async (tx) => {
  // Postgres advisory lock keyed on org id
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`);
  const { count } = await tx.select({ count: sql<number>`count(*)` })...
  if (count >= limit) throw new TRPCError({ code: 'FORBIDDEN', message: 'limit reached' });
  await tx.update(...).set({ containerId: ... });
});
```

Or rely on a unique partial index `WHERE container_id IS NOT NULL` — but that only handles the "already assigned" race (#16), not the limit cap.

## Related
- #16 (assignVideo TOCTOU on `containerId` is the related but distinct race)
