# VidTempla - Claude Code Rules

## Project Overview
VidTempla is a YouTube description management tool built with Next.js 15, TypeScript, PlanetScale Postgres, Drizzle ORM, Better Auth, and tRPC.

## Git Commit
Git commit anytime you make a big change, and for big changes, also split up into smaller logical commits as well. You should do this automatically without asking me for permission every single time. Your commits should be detailed in a way that you understand, in case you need to look back at the Git commit history.

## Tech Stack & Architecture
- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Backend**: tRPC for type-safe APIs, Next.js API routes
- **Database**: PlanetScale Postgres with Drizzle ORM
- **Authentication**: Better Auth (magic link + Google OAuth)
- **Background Jobs**: Inngest for scheduled tasks
- **Payments**: Stripe
- **Type Safety**: Full TypeScript with end-to-end type safety via Drizzle + tRPC

## Project Structure
```
vidtempla/
├── nextjs/                    # Main Next.js application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/           # Reusable UI components (Radix UI)
│   │   │   ├── layout/       # Layout components
│   │   │   └── [feature]/    # Feature-specific components
│   │   ├── config/           # App configuration
│   │   │   └── app.ts        # Main app config
│   │   ├── db/               # Drizzle ORM
│   │   │   ├── schema.ts     # Table definitions
│   │   │   ├── relations.ts  # Drizzle relations
│   │   │   └── index.ts      # DB client
│   │   ├── lib/
│   │   │   ├── auth.ts       # Better Auth server config
│   │   │   └── auth-client.ts # Better Auth client
│   │   ├── pages/            # Next.js pages
│   │   │   ├── dashboard/    # Dashboard pages
│   │   │   └── api/          # API routes
│   │   ├── server/           # tRPC server and routers
│   │   │   └── api/          # tRPC API definitions
│   │   └── hooks/            # React hooks (useUser, etc.)
│   ├── drizzle/              # Drizzle migrations
│   ├── scripts/              # One-off scripts (data migration, etc.)
│   ├── .env.example          # Environment variables template
│   └── package.json
└── tasks/                    # Migration plans and docs
```

Always run npm run dev within the Next.js project.

## Database Workflow (Drizzle ORM)

### Schema Changes
1. Edit `nextjs/src/db/schema.ts` to modify table definitions
2. Generate migration: `npx drizzle-kit generate`
3. Apply locally: `npx drizzle-kit push` (or `npx drizzle-kit migrate`)
4. For custom SQL (triggers, functions): create manual SQL file in `nextjs/drizzle/`

### Remote Server
NEVER apply migrations to the remote server. Prompt the user to do this manually.

### Key Tables
- **Better Auth**: `user`, `session`, `account`, `verification`
- **App**: `youtube_channels`, `youtube_videos`, `containers`, `templates`, `video_variables`, `description_history`, `subscriptions`, `webhook_events`

### Authentication & Security
- Better Auth handles auth via `nextjs/src/lib/auth.ts` (server) and `nextjs/src/lib/auth-client.ts` (client)
- User isolation enforced in tRPC procedures via WHERE clauses (no RLS)
- Middleware checks `better-auth.session_token` cookie for protected routes
- Never expose sensitive data in client-side code

### Type Safety
- Use TypeScript for all code
- Schema types come from Drizzle (`nextjs/src/db/schema.ts`)
- Use tRPC for end-to-end type safety
- Avoid `any` type - use proper TypeScript types

### Design / Component Development
- Use Radix UI primitives for accessible components
- Follow existing patterns in `src/components/ui/`
- Implement proper loading states and error handling
- Use Tailwind CSS for styling
- Make components responsive by default

## Common Development Workflows

### Adding New Dashboard Features
1. Add navigation items to `src/config/app.ts`
2. Create page components in `src/pages/dashboard/`
3. Implement tRPC procedures with auth checks
4. Add UI components with proper error handling

### Environment Setup
- Use `.env.example` as template for environment variables
- Never commit `.env.local` to version control
- Ensure all required environment variables are set

## File Naming Conventions
- Components: PascalCase (e.g., `DashboardSidebar.tsx`)
- Pages: kebab-case (e.g., `dashboard/youtube/index.tsx`)
- Utilities: camelCase (e.g., `utils/api.ts`)
- Types: PascalCase (e.g., `types/Database.ts`)

## Key Configuration Files
- `nextjs/src/db/schema.ts` - Drizzle schema (source of truth for DB types)
- `nextjs/src/lib/auth.ts` - Better Auth server configuration
- `nextjs/src/config/app.ts` - Main app configuration
- `nextjs/.env.example` - Environment variables template
- `nextjs/drizzle.config.ts` - Drizzle Kit configuration
- `tailwind.config.ts` - Tailwind CSS configuration

## Security Considerations
- User isolation via tRPC WHERE clauses (no database-level RLS)
- Validate all user inputs and API requests
- Keep environment variables secure and documented
