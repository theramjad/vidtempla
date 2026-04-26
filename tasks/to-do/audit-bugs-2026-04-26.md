# Bug Audit — 2026-04-26

**Source:** 5 Claude Opus exploratory agents → 5 Claude Opus verifier agents → 3 OpenAI Codex (gpt-5.5 xhigh) consults. **34 bugs verified across all three layers.** 0 refuted by codex.

Each bug is a separate task file under `tasks/to-do/bugs/`. Pick one up and move it to `tasks/doing/bugs/` when starting.

## 🔴 Critical — fix first

| # | Title | File |
|---|---|---|
| 01 | REST templates filter by `userId`, not `organizationId` | [01-templates-rest-org-isolation.md](bugs/01-templates-rest-org-isolation.md) |
| 02 | REST containers filter by `userId`, not `organizationId` | [02-containers-rest-org-isolation.md](bugs/02-containers-rest-org-isolation.md) |
| 03 | YouTube proxy routes drop `organizationId` from `getChannelTokens` | [03-youtube-proxies-org-isolation.md](bugs/03-youtube-proxies-org-isolation.md) |
| 04 | `upsertCredits` resets balance on every Stripe sub update | [04-stripe-credits-reset-on-update.md](bugs/04-stripe-credits-reset-on-update.md) |
| 05 | Stripe webhook idempotency broken | [05-stripe-webhook-idempotency.md](bugs/05-stripe-webhook-idempotency.md) |
| 06 | Stripe webhook returns 200 on internal error | [06-stripe-webhook-200-on-error.md](bugs/06-stripe-webhook-200-on-error.md) |
| 07 | `withApiKey` org fallback to userId (latent until #1-#3 land) | [07-api-key-org-fallback.md](bugs/07-api-key-org-fallback.md) |

## 🟠 High

| # | Title | File |
|---|---|---|
| 08 | `getAffectedVideos` enumerates videos with no org filter | [08-get-affected-videos-no-org-filter.md](bugs/08-get-affected-videos-no-org-filter.md) |
| 09 | Destructive billing/keys mutations use `orgProcedure` | [09-org-admin-procedure-on-billing-and-keys.md](bugs/09-org-admin-procedure-on-billing-and-keys.md) |
| 10 | Cron secret bypass when `CRON_SECRET` unset | [10-cron-secret-bypass.md](bugs/10-cron-secret-bypass.md) |
| 11 | External YouTube HTTP call inside DB transaction | [11-external-http-in-db-transaction.md](bugs/11-external-http-in-db-transaction.md) |
| 12 | MCP handler trusts stale `activeOrganizationId` | [12-mcp-stale-active-org.md](bugs/12-mcp-stale-active-org.md) |
| 13 | `subscriptions` table has zero uniqueness | [13-subscriptions-no-uniqueness.md](bugs/13-subscriptions-no-uniqueness.md) |
| 14 | `apiKeys.keyHash` no unique constraint, no index | [14-api-keys-keyhash-no-unique-index.md](bugs/14-api-keys-keyhash-no-unique-index.md) |
| 15 | Plan-limit TOCTOU in `assignVideo` | [15-plan-limit-toctou.md](bugs/15-plan-limit-toctou.md) |
| 16 | `assignVideo` containerId TOCTOU | [16-assign-video-toctou.md](bugs/16-assign-video-toctou.md) |
| 17 | Cron sync overlap with no CAS lock | [17-cron-sync-overlap.md](bugs/17-cron-sync-overlap.md) |
| 18 | `syncOwnedChannelVideos` runs on every list call | [18-sync-on-every-list-call.md](bugs/18-sync-on-every-list-call.md) |
| 19 | YouTube `invalid_grant` not handled | [19-invalid-grant-not-handled.md](bugs/19-invalid-grant-not-handled.md) |
| 20 | Encryption salt is decorative; `normalizeKey` weak | [20-encryption-decorative-salt.md](bugs/20-encryption-decorative-salt.md) |
| 21 | `ENCRYPTION_KEY_V2` cosmetic — no rotation path | [21-encryption-no-rotation.md](bugs/21-encryption-no-rotation.md) |

## 🟡 Medium

| # | Title | File |
|---|---|---|
| 22 | Pagination cursors unstable on duplicate timestamps | [22-pagination-cursor-unstable.md](bugs/22-pagination-cursor-unstable.md) |
| 23 | REST envelope meta-keys violate documented contract | [23-rest-envelope-meta-keys.md](bugs/23-rest-envelope-meta-keys.md) |
| 24 | YouTube `quotaExceeded` not translated to 429 | [24-youtube-quota-not-translated.md](bugs/24-youtube-quota-not-translated.md) |
| 25 | `analytics/query` accepts unvalidated body | [25-analytics-unvalidated-body.md](bugs/25-analytics-unvalidated-body.md) |
| 26 | `subscription.deleted` doesn't clear `stripeSubscriptionId` | [26-stripe-deleted-leaves-subid.md](bugs/26-stripe-deleted-leaves-subid.md) |
| 27 | Stripe Checkout not pinned to customer ID | [27-checkout-not-pinned-to-customer.md](bugs/27-checkout-not-pinned-to-customer.md) |
| 28 | `HistoryDrawer` rendered without `key` prop | [28-history-drawer-no-key-prop.md](bugs/28-history-drawer-no-key-prop.md) |
| 29 | Org settings `useState(name)` no resync | [29-org-settings-usestate-no-resync.md](bugs/29-org-settings-usestate-no-resync.md) |
| 30 | Settings post-checkout `useEffect` re-entrant | [30-settings-post-checkout-reentrant.md](bugs/30-settings-post-checkout-reentrant.md) |
| 31 | `auth/callback.tsx` `session` in deps | [31-auth-callback-session-deps.md](bugs/31-auth-callback-session-deps.md) |
| 32 | `apiKeys.lastUsedAt` errors silently swallowed | [32-apikeys-lastusedat-silent-errors.md](bugs/32-apikeys-lastusedat-silent-errors.md) |
| 33 | N+1 queries in `syncOwnedChannelVideos` | [33-n-plus-one-sync-owned-channel.md](bugs/33-n-plus-one-sync-owned-channel.md) |
| 34 | `containers.ts` selects videos before ownership check | [34-containers-select-before-ownership-check.md](bugs/34-containers-select-before-ownership-check.md) |

## ❌ Refuted (no file)
- **R1** — Stale form state in `TemplatesTab.tsx` Edit Dialog. `openEditDialog` unconditionally repopulates `formData` on every open. Despite missing `key` prop, the bug pattern is not present.

## 🤷 Inconclusive (no file)
- **I1** — Magic-link single-use/expiration. `lib/auth.ts:83-87` only sets `sendMagicLink`; relies on Better Auth plugin defaults. **Recommend pinning `expiresIn` and rate-limiting explicitly** rather than trusting library defaults.
- **I2** — Migrations 0006-0008 not transaction-wrapped together. Drizzle wraps each file in its own txn; the real risk is between deploys, not within a single migrate run.

---

## Recommended fix order

| Order | Group | Bugs | Why |
|---|---|---|---|
| 1 | Org isolation cluster | #01, #02, #03, #07, #34 + backfill migration | Single root cause, biggest blast radius. Fix together as one PR. |
| 2 | Stripe billing | #04, #05, #06 (in that order) | Money/trust risk. #05 must land before #06 or retries replay state. |
| 3 | Auth tier | #09 | One-line swaps. Closes a clean privilege escalation. |
| 4 | Cron hardening | #10 | One-file fix. |
| 5 | Cross-tenant reads | #08, #12 | Close remaining org-leak surface. |
| 6 | Concurrency | #11, #15, #16, #17, #18 | TOCTOU + lock-during-HTTP. |
| 7 | Schema hardening | #13, #14 | Add unique indexes. |
| 8 | Encryption | #20 → #21 | #20 is a prerequisite for proper rotation in #21. |
| 9 | OAuth UX | #19 | Surface `tokenStatus = invalid` instead of 500-loop. |
| 10 | REST contract | #22, #23, #24, #25 | Pagination cursors, envelope shape, quota mapping, validation. |
| 11 | React polish | #26, #27, #28, #29, #30, #31, #32 | Small fixes, low risk. |
| 12 | Perf | #33 | N+1 cleanup. |
