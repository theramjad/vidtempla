# Migration Plan: Supabase → PlanetScale Postgres + Drizzle ORM + Better Auth

## Context

The app (VidTempla) is a YouTube description management tool built on Next.js 15 + Supabase + tRPC + Inngest. It has < 100 production users. We're migrating to PlanetScale Postgres for the database, Drizzle ORM for queries, and Better Auth for authentication. Goals: eliminate Supabase vendor lock-in, gain ORM-level type safety, and get a more flexible auth system.

### Key Decisions (from interview)
- **RLS**: Remove entirely — enforce user isolation in app layer (tRPC WHERE clauses)
- **Triggers**: Keep as DB triggers via raw SQL in Drizzle migrations
- **Auth methods**: Email Magic Link + Google OAuth (same as current)
- **User table**: Better Auth's `user` table with UUID generation, migrate existing users into it
- **Data migration**: Migrate everything via a single automated script
- **Email provider**: Resend for magic links
- **API routes**: Keep mixed (App Router for Stripe webhook, Pages Router for rest)
- **Inngest jobs**: Convert fully to Drizzle
- **Auth UI**: Keep existing UI, swap underlying API calls
- **Schema**: Fresh Drizzle schema definitions (no replaying old migrations)
- **Cleanup**: Remove all Supabase files
- **Plan limits**: Refactor to `(db, userId)` pure function
- **Session cutover**: Force logout all users on deploy
- **Client state**: Replace Zustand auth store with Better Auth React hooks
- **Session checks**: Both middleware + tRPC context

---

## Phase 0: Setup & Dependencies

### 0.1 Install packages
```
npm install drizzle-orm postgres better-auth resend
npm install -D drizzle-kit @better-auth/cli
```

### 0.2 Create Drizzle config
**Create**: `nextjs/drizzle.config.ts`
- Schema path: `./src/db/schema.ts`
- Output: `./drizzle/`
- Dialect: `postgresql`
- Connection: `DATABASE_URL` env var

### 0.3 Define Drizzle schema
**Create**: `nextjs/src/db/schema.ts`

Define all 8 app tables + Better Auth's 4 tables:

| Table | Key columns | Notes |
|-------|-------------|-------|
| `user` | id (uuid), name, email, emailVerified, image, createdAt, updatedAt | Better Auth managed |
| `session` | id, userId FK→user, token, expiresAt, ipAddress, userAgent | Better Auth managed |
| `account` | id, userId FK→user, accountId, providerId, accessToken, refreshToken | Better Auth managed |
| `verification` | id, identifier, value, expiresAt | Better Auth managed |
| `youtube_channels` | id (uuid), user_id FK→user, channel_id, encrypted tokens, sync_status enum, token_status enum | |
| `youtube_videos` | id (uuid), channel_id FK→youtube_channels, video_id, container_id FK→containers (nullable) | |
| `templates` | id (uuid), user_id FK→user, name, content | |
| `containers` | id (uuid), user_id FK→user, name, template_order (uuid[]), separator | Verify PlanetScale array support; fallback to jsonb if needed |
| `video_variables` | id (uuid), video_id FK, template_id FK, variable_name, variable_value | Unique on (video_id, template_id, variable_name) |
| `description_history` | id (uuid), video_id FK, description, version_number, created_at, created_by FK→user | |
| `subscriptions` | id (uuid), user_id FK→user, stripe_* fields, plan_tier enum, status enum | |
| `webhook_events` | id (uuid), event_id (unique), event_type, payload (jsonb), processed | |

### 0.4 Define Drizzle relations
**Create**: `nextjs/src/db/relations.ts`
- All FK relationships for the relational query builder

### 0.5 Create Drizzle client
**Create**: `nextjs/src/db/index.ts`
- Use `postgres` driver with `DATABASE_URL`
- Export `db` instance and `Database` type

### 0.6 Generate initial migration + triggers
- Run `drizzle-kit generate` for schema migration
- Add custom SQL migration for 3 trigger functions:
  - `update_updated_at_column()` — on all main tables
  - `prevent_container_reassignment()` — on youtube_videos
  - `set_next_version_number()` — on description_history

### 0.7 Set up Better Auth server
**Create**: `nextjs/src/lib/auth.ts`
- Drizzle adapter with `provider: 'pg'`
- Google social provider
- Magic link plugin with Resend email sending
- UUID generation via `advanced.generateId`

### 0.8 Set up Better Auth client
**Create**: `nextjs/src/lib/auth-client.ts`
- `createAuthClient` with `magicLinkClient` plugin

### 0.9 Create Better Auth API route
**Create**: `nextjs/src/pages/api/auth/[...all].ts`
- `toNodeHandler(auth.handler)` with `bodyParser: false`

### 0.10 Update env vars
- **Remove**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Add**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`
- Google OAuth creds for auth (separate from YouTube OAuth creds)

**Verify**: `drizzle-kit push` against dev PlanetScale DB. App still runs on Supabase.

---

## Phase 1: Database Access Layer (Supabase queries → Drizzle)

### 1.1 Update tRPC context
**Modify**: `nextjs/src/server/trpc/context.ts`
- Import `db` from `@/db`
- Keep Supabase auth temporarily (swapped in Phase 2)
- Context type: `{ db: Database, user: User | null }`

### 1.2 Convert YouTube router (~50 queries)
**Modify**: `nextjs/src/server/api/routers/dashboard/youtube.ts`

Key query conversions:
- `.from('table').select('*').eq('user_id', id)` → `db.select().from(table).where(eq(table.userId, id))`
- `.select('*, related:table(count)')` → separate count subquery or Drizzle `with` relations
- `.contains('template_order', [id])` → `` sql`${id} = ANY(${containers.templateOrder})` ``
- `.upsert(data, { onConflict })` → `db.insert().onConflictDoUpdate()`
- `.select('*', { count: 'exact', head: true })` → `db.select({ count: count() }).from(table)`
- `.is('container_id', null)` → `isNull(youtubeVideos.containerId)`
- `.ilike('title', '%search%')` → `` ilike(youtubeVideos.title, `%${search}%`) ``

### 1.3 Convert billing router (~12 queries)
**Modify**: `nextjs/src/server/api/routers/dashboard/billing.ts`

### 1.4 Convert AI router (~10 queries)
**Modify**: `nextjs/src/server/api/routers/dashboard/ai.ts`

### 1.5 Convert Inngest jobs
**Modify**:
- `nextjs/src/inngest/youtube/syncChannelVideos.ts` — replace `createClient<Database>(url, key)` with imported `db`
- `nextjs/src/inngest/youtube/updateVideoDescriptions.ts` — same
- `nextjs/src/inngest/youtube/scheduledSync.ts` — same

### 1.6 Convert Stripe webhook
**Modify**: `nextjs/src/app/api/webhooks/stripe/route.ts`

### 1.7 Convert YouTube OAuth callback (DB queries only)
**Modify**: `nextjs/src/pages/api/auth/youtube/callback.ts`
- Swap DB queries to Drizzle; keep Supabase auth check temporarily

### 1.8 Refactor plan-limits
**Modify**: `nextjs/src/lib/plan-limits.ts`
- Change signature from `(supabase: SupabaseClient)` to `(db: Database, userId: string)`
- Update all callers in youtube.ts and youtube/callback.ts

### 1.9 Delete Supabase service client
**Delete**: `nextjs/src/lib/clients/supabase.ts` (after all imports removed)

**Verify**: All tRPC procedures, Inngest jobs, webhooks, and OAuth callbacks work with Drizzle against PlanetScale.

---

## Phase 2: Authentication (Supabase Auth → Better Auth)

### 2.1 Replace tRPC auth context
**Modify**: `nextjs/src/server/trpc/context.ts`
- Replace `supabase.auth.getUser()` with `auth.api.getSession({ headers })`
- Context user comes from Better Auth session

### 2.2 Replace tRPC auth middleware
**Modify**: `nextjs/src/server/trpc/init.ts`
- `isAuthed` middleware checks `ctx.user` from Better Auth (same pattern, different source)

### 2.3 Replace route middleware
**Modify**: `nextjs/src/middleware.ts`
- Replace Supabase `updateSession()` with `auth.api.getSession({ headers })`
- Redirect to `/sign-in` if no session on `/dashboard/*` routes

**Delete**: `nextjs/src/utils/supabase/middleware.ts`

### 2.4 Replace client auth state
**Delete**: `nextjs/src/stores/use-auth-store.ts`

**Rewrite**: `nextjs/src/hooks/useUser.tsx`
- Use `authClient.useSession()` instead of Zustand store
- Expose `{ user, session, loading, signOut }` (same interface)

### 2.5 Rewrite sign-in page
**Modify**: `nextjs/src/pages/sign-in.tsx`
- Replace `supabase.auth.signInWithOtp()` with `authClient.signIn.magicLink({ email })`
- Keep OTP input UI if Better Auth magic link plugin supports OTP verification; otherwise simplify to link-only
- Replace `supabase.auth.verifyOtp()` with Better Auth verification

### 2.6 Rewrite sign-up page
**Modify**: `nextjs/src/pages/sign-up.tsx`
- Same pattern as sign-in with `shouldCreateUser` equivalent

### 2.7 Rewrite Google sign-in button
**Modify**: `nextjs/src/components/GoogleSignInButton.tsx`
- Replace `supabase.auth.signInWithOAuth({ provider: 'google' })` with `authClient.signIn.social({ provider: 'google' })`

### 2.8 Update auth callback page
**Modify**: `nextjs/src/pages/auth/callback.tsx`
- Simplify: check for active session, redirect to dashboard
- Better Auth handles OAuth callbacks via its catch-all route

**Delete**: `nextjs/src/pages/api/auth/callback.ts` (replaced by Better Auth catch-all)

### 2.9 Update YouTube OAuth routes
**Modify**: `nextjs/src/pages/api/auth/youtube/callback.ts`
- Replace `supabase.auth.getSession()` with `auth.api.getSession({ headers })`

**Modify**: `nextjs/src/pages/api/auth/youtube/initiate.ts`
- Same auth check swap

### 2.10 Update settings page
**Modify**: `nextjs/src/pages/dashboard/settings.tsx`
- Replace Supabase browser client with Better Auth hooks for user info

### 2.11 Update `_app.tsx`
**Modify**: `nextjs/src/pages/_app.tsx`
- Remove `useUser()` initialization call (Better Auth handles its own state)
- Or keep `useUser()` if needed for global auth state

**Verify**: Full auth flow — magic link sign-in, Google OAuth, sign-out, middleware redirect, tRPC auth, YouTube OAuth callback.

---

## Phase 3: Data Migration Script

**Create**: `nextjs/scripts/migrate-data.ts`

### Script flow:
1. Connect to Supabase (source) and PlanetScale (target) via `postgres` driver
2. Export `auth.users` from Supabase (via Supabase admin API or direct `auth` schema query with service role)
3. Insert into Better Auth `user` table — preserve UUIDs, map `email_confirmed_at` → `emailVerified`
4. For Google OAuth users: query `auth.identities`, create Better Auth `account` rows
5. Export + insert all public tables in FK order:
   - youtube_channels → youtube_videos → video_variables, description_history
   - templates, containers
   - subscriptions, webhook_events
6. Verify row counts match

### Key considerations:
- Disable triggers during import OR use explicit column values (version_number, updated_at)
- Encrypted YouTube tokens copy byte-for-byte (same `ENCRYPTION_KEY`)
- `user_id` UUIDs stay the same — no remapping needed

---

## Phase 4: Cleanup

### 4.1 Delete Supabase files
- `supabase/` (entire directory)
- `shared-types/database.types.ts`
- `nextjs/src/utils/supabase/` (all 6 files)
- `nextjs/src/lib/clients/supabase.ts`
- `nextjs/src/stores/use-auth-store.ts`
- `nextjs/src/pages/api/auth/callback.ts`

### 4.2 Remove Supabase packages
```
npm uninstall @supabase/ssr @supabase/supabase-js
```

### 4.3 Update env files
- Remove Supabase vars from `.env.example` and env schema
- Document new vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`

### 4.4 Update CLAUDE.md
- Replace Supabase migration workflow with Drizzle workflow
- Update tech stack section
- Remove references to `supabase db diff`, `supabase migration up`, etc.

### 4.5 Clean up tsconfig
- Remove `@shared-types` path alias if present

**Verify**: `npm run build` succeeds. `grep -r "supabase" src/` returns nothing. All features work end-to-end.

---

## Phase 5: Deploy & Cutover

1. Create PlanetScale production database, apply schema (`drizzle-kit migrate`)
2. Set all production env vars
3. Verify Resend domain, update Google OAuth redirect URIs for Better Auth
4. Run `scripts/migrate-data.ts` against production
5. Deploy — all users force-logged-out, sign in fresh with Better Auth
6. Post-deploy verification: sign-in, YouTube connect, sync, templates, containers, description updates, Stripe billing

---

## Risks

| Risk | Mitigation |
|------|------------|
| PlanetScale may not support `uuid[]` array columns | Test early in Phase 0. Fallback: convert `template_order` to `jsonb` |
| Better Auth magic link may not support OTP code entry | Verify plugin capabilities. Fallback: link-only flow (remove OTP input UI) |
| Connection pooling in serverless (Inngest, Vercel) | PlanetScale provides PgBouncer on port 6432; use for serverless connections |
| Supabase `.contains()` array query has no direct Drizzle equivalent | Use `` sql`${id} = ANY(${col})` `` raw SQL expression |

---

## Files Summary

### Create (9 files)
- `nextjs/drizzle.config.ts`
- `nextjs/src/db/schema.ts`
- `nextjs/src/db/relations.ts`
- `nextjs/src/db/index.ts`
- `nextjs/src/lib/auth.ts`
- `nextjs/src/lib/auth-client.ts`
- `nextjs/src/pages/api/auth/[...all].ts`
- `nextjs/scripts/migrate-data.ts`
- `drizzle/` migrations directory (generated)

### Modify (18 files)
- `nextjs/src/server/trpc/context.ts`
- `nextjs/src/server/trpc/init.ts`
- `nextjs/src/server/api/routers/dashboard/youtube.ts`
- `nextjs/src/server/api/routers/dashboard/billing.ts`
- `nextjs/src/server/api/routers/dashboard/ai.ts`
- `nextjs/src/inngest/youtube/syncChannelVideos.ts`
- `nextjs/src/inngest/youtube/updateVideoDescriptions.ts`
- `nextjs/src/inngest/youtube/scheduledSync.ts`
- `nextjs/src/app/api/webhooks/stripe/route.ts`
- `nextjs/src/pages/api/auth/youtube/callback.ts`
- `nextjs/src/pages/api/auth/youtube/initiate.ts`
- `nextjs/src/lib/plan-limits.ts`
- `nextjs/src/middleware.ts`
- `nextjs/src/hooks/useUser.tsx`
- `nextjs/src/pages/sign-in.tsx`
- `nextjs/src/pages/sign-up.tsx`
- `nextjs/src/components/GoogleSignInButton.tsx`
- `nextjs/src/pages/auth/callback.tsx`

### Delete (10+ files)
- `supabase/` (entire directory)
- `shared-types/database.types.ts`
- `nextjs/src/utils/supabase/*` (6 files)
- `nextjs/src/lib/clients/supabase.ts`
- `nextjs/src/stores/use-auth-store.ts`
- `nextjs/src/pages/api/auth/callback.ts`
