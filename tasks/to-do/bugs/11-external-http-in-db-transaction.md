# 11: External YouTube HTTP call inside DB transaction holding `FOR UPDATE`

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/workflows/update-video-descriptions.ts:42-103` — txn opens at :42, `FOR UPDATE` at :53, YouTube call at :80
- `nextjs/src/lib/services/videos.ts:1046` — `revertDescription` repeats the pattern
- `nextjs/src/lib/clients/youtube.ts:484` — the actual call is `axios.put` (HTTP PUT, not POST as originally claimed)

## Bug
`db.transaction` opens, `SELECT ... FOR UPDATE` takes the row lock, then `await updateVideoDescription(...)` makes a YouTube HTTP PUT inside the transaction. The lock is held across the entire HTTP RTT.

If the DB commit fails after the YouTube call succeeds, YouTube has the new description but the DB rolled back — drift detection then flags it as a manual edit.

## Impact
- Lock held during full HTTP RTT (degrades concurrency on hot videos)
- DB ↔ YouTube state divergence on rollback
- Workflow retries can replay the YouTube PUT (idempotent in this case, but the divergence remains)

**Note:** `resolveDrift` blocks at `videos.ts:1167` and `1229` are clean (DB-only). Earlier audits flagged these — verifier refuted.

## Fix (outbox/saga pattern)
1. Inside the txn: write a "pending" intent row, commit
2. Outside the txn: make the YouTube PUT
3. On success: write the "applied" row (CAS by intent id)
4. On failure: leave intent row for the reconciliation worker to retry

Avoids row locks across HTTP RTT and avoids divergent state on rollback.
