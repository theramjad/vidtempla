# Admin Dashboard Template - Claude Code Rules

## Project Overview
This is an admin dashboard template built with Next.js 15, TypeScript, Supabase, and tRPC. It provides a complete foundation for building admin interfaces. The user will be building upon this template.

## Git Commit
Git commit anytime you make a big change, and for big changes, also split up into smaller logical commits as well. You should do this automatically without asking me for permission every single time. Your commits should be detailed in a way that you understand, in case you need to look back at the Git commit history.

## Tech Stack & Architecture
- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Backend**: tRPC for type-safe APIs, Next.js API routes
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Supabase Auth with email-based admin controls
- **Background Jobs**: Inngest for scheduled tasks
- **Type Safety**: Full TypeScript with end-to-end type safety

## Project Structure
```
youtube-description-updater/
├── nextjs/                    # Main Next.js application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/           # Reusable UI components (Radix UI)
│   │   │   ├── layout/       # Layout components
│   │   │   └── [feature]/    # Feature-specific components
│   │   ├── config/           # App configuration
│   │   │   └── app.ts        # Main app config (includes admin emails)
│   │   ├── pages/            # Next.js pages
│   │   │   ├── dashboard/    # Dashboard pages
│   │   │   └── api/          # API routes
│   │   ├── server/           # tRPC server and routers
│   │   │   └── api/          # tRPC API definitions
│   │   └── utils/            # Utility functions
│   ├── .env.example          # Environment variables template
│   └── package.json
├── shared-types/             # Shared TypeScript types
│   └── database.types.ts     # Generated Supabase types
└── supabase/                # Supabase configuration
    ├── migrations/          # Database migration files
    └── config.toml         # Supabase configuration
```

Always run npm run dev within the Next.js project.

## Core Development Principles

## Database Migration Workflow

### 1. Making Schema Changes
- Edit files in `supabase/schemas/` to define your database structure
- Use numeric prefixes for dependency order: `01_users.sql`, `02_posts.sql`, etc.
- Tables with foreign keys must come after their referenced tables

### 2. Generate Migration
```bash
supabase db diff -f <migration_name>
```
This compares your schema files with the current database and creates a migration.

### 2a. Manual Migrations
When you need to write migrations manually (e.g., dropping constraints, altering tables):
1. Get the current timestamp:
   ```bash
   date +"%Y%m%d%H%M%S"
   ```
2. Create a new file in `apps/supabase/migrations/` named `<timestamp>_<meaningful_name>.sql`
3. Write your SQL migration
4. Apply with `cd apps/supabase && supabase migration up`

### 2b. Functions: write migrations manually
- For `FUNCTION` objects, always write migrations by hand rather than relying on `db diff`.
- Reason: the Supabase CLI does not reliably detect function body changes and can produce unstable diffs; also we often need explicit `DROP FUNCTION IF EXISTS ...` before `CREATE OR REPLACE FUNCTION` to update signatures safely.
- Steps:
  1. Update the function source under `apps/supabase/schemas/functions/*.sql`.
  2. Get the current timestamp for the migration filename:
     ```bash
     date +"%Y%m%d%H%M%S"
     ```
  3. Create a new file in `apps/supabase/migrations/` named `<timestamp>_<meaningful_name>.sql`.
  4. In that file, include:
     - `DROP FUNCTION IF EXISTS schema.fn_name;`
     - A full `CREATE OR REPLACE FUNCTION ...` definition.
  5. Commit both the schema file change and the new migration file together.
  6. Apply locally with `supabase migration up` in the supabase folder.

### 3. Apply the migration locally

Run the following command in the supabase folder
```bash
supabase migration up
```
Applies pending migrations to your local Supabase database. **Note: Must be run from the `apps/supabase` directory.**

### 4. Remote server

NEVER apply migrations to the remote server. You will be severely punished if you do Prompt the user to do this manually. 

### 5. Generate Types Using

```base
npx supabase gen types typescript --local > shared-types/database.types.ts
```

### Authentication & Security
- Admin access controlled by email addresses in `nextjs/src/config/app.ts`
- Always verify admin permissions in tRPC procedures
- Use Supabase RLS policies for additional security
- Never expose sensitive data in client-side code

### Type Safety
- Use TypeScript for all code
- Import database types from `shared-types/database.types.ts`
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
3. Implement tRPC procedures with admin permission checks
4. Add UI components with proper error handling
5. Test with both admin and non-admin users

### Environment Setup
- Use `.env.example` as template for environment variables
- Never commit `.env.local` to version control
- Update admin emails in `nextjs/src/config/app.ts`
- Ensure all required environment variables are set

## File Naming Conventions
- Components: PascalCase (e.g., `DashboardSidebar.tsx`)
- Pages: kebab-case (e.g., `dashboard/youtube/index.tsx`)
- Utilities: camelCase (e.g., `utils/api.ts`)
- Types: PascalCase (e.g., `types/Database.ts`)

## Key Configuration Files
- `nextjs/src/config/app.ts` - Main app configuration including admin emails
- `nextjs/.env.example` - Environment variables template
- `supabase/config.toml` - Supabase configuration
- `tailwind.config.ts` - Tailwind CSS configuration

## Security Considerations
- Admin access is email-based - update `adminEmails` array in config
- Use Supabase RLS policies for database security
- Validate all user inputs and API requests
- Keep environment variables secure and documented

## When Working on This Project
1. Always start by understanding the current database schema
2. Use migrations for any database changes
3. Regenerate types after schema changes
4. Follow the existing code patterns and conventions
5. Test admin permissions thoroughly
6. Update documentation when adding new features

Remember: This is a production-ready template focused on security, type safety, and maintainability.