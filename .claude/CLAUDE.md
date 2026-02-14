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

## Remote Server
NEVER apply migrations to the remote server. Prompt the user to do this manually.

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
- User isolation via tRPC WHERE clauses (no database-level RLS)
