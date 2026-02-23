# Project Overview
VidTempla is a YouTube description management tool built with Next.js 15, TypeScript, PlanetScale Postgres, Drizzle ORM, Better Auth, and tRPC.

# Tech Stack & Architecture
- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Backend**: tRPC for type-safe APIs, Next.js API routes
- **Database**: PlanetScale Postgres with Drizzle ORM
- **Authentication**: Better Auth (magic link + Google OAuth)
- **Background Jobs**: Inngest for scheduled tasks
- **Payments**: Stripe
- **Type Safety**: Full TypeScript with end-to-end type safety via Drizzle + tRPC

# Database Workflow (Drizzle ORM)

## Schema Changes
1. Edit `nextjs/src/db/schema.ts` to modify table definitions
2. Generate migration: `npx drizzle-kit generate`
3. Apply locally: `npx drizzle-kit push` (or `npx drizzle-kit migrate`)
4. For custom SQL (triggers, functions): create manual SQL file in `nextjs/drizzle/`

## Deployment
Vercel build (`vercel-build`) automatically runs migrations on deploy, so pushing to main applies schema changes to the remote database. No manual migration step needed for remote.

# Authentication & Security
- Better Auth handles auth via `nextjs/src/lib/auth.ts` (server) and `nextjs/src/lib/auth-client.ts` (client)
- User isolation enforced in tRPC procedures via WHERE clauses (no RLS)
- Middleware checks `better-auth.session_token` cookie for protected routes
- Never expose sensitive data in client-side code

## Type Safety
- Use TypeScript for all code
- Schema types come from Drizzle (`nextjs/src/db/schema.ts`)
- Use tRPC for end-to-end type safety
- Avoid `any` type - use proper TypeScript types

# Security Considerations
- **This is a public GitHub repository.** Never commit secrets, API keys, passwords, database URLs, or any sensitive credentials. Always use environment variables and ensure `.env.local` is gitignored. Before committing, review staged changes for anything that could expose sensitive information.
- User isolation via tRPC WHERE clauses (no database-level RLS)

# Long-Term Vision
VidTempla is an API-first platform where AI agents securely manage YouTube channels. The dashboard serves humans; the REST API serves agents. Instead of storing YouTube data, the API proxies YouTube's APIs on-demand so agents get real-time data while VidTempla handles OAuth complexity.

# REST API Architecture (`/api/v1/`)

## Design Principles
- Response envelope: `{ data, error, meta }` — never bare arrays
- Error format: `{ code, message, suggestion, status }` — always include `suggestion` so agents can self-correct
- Cursor-based pagination on all list endpoints (`?cursor=...&limit=50`)
- Field selection on proxy endpoints (`?fields=id,title,viewCount`)
- camelCase JSON, kebab-case URLs
- Every proxy endpoint documents its YouTube API quota cost

## Key Files
- `nextjs/src/lib/api-auth.ts` — `withApiKey()` middleware, `apiSuccess()`, `apiError()`, `logRequest()`
- `nextjs/src/lib/api-keys.ts` — `generateApiKey()`, `hashApiKey()`
- `nextjs/src/app/api/v1/` — all REST endpoints (see `CLAUDE.md` in that directory)
- `nextjs/src/db/schema.ts` — `apiKeys` and `apiRequestLog` tables

## Endpoint Groups
- **Channels**: list, details, overview, sync, analytics, search
- **Videos**: list, details, analytics, retention, assign, variables
- **Templates**: CRUD + impact analysis
- **Containers**: CRUD
- **YouTube Management**: playlists, comments, thumbnails, captions (proxy)
- **Analytics**: flexible YouTube Analytics API queries
- **Usage**: API request tracking and quota monitoring

## Adding New Endpoints
Follow the `withApiKey` pattern in `nextjs/src/lib/api-auth.ts`. See `nextjs/src/app/api/v1/CLAUDE.md` for the full guide.
