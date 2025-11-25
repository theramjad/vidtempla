# tRPC + Supabase Migration Guide

This guide documents how to migrate a Next.js project from Pages Router tRPC with password authentication to App Router tRPC with passwordless OTP authentication and proper Supabase SSR integration.

## Overview

This conversion was successfully applied to migrate the agentstack project to match the vidtempla architecture:

- **Authentication**: Password → Passwordless OTP (magic link + 6-digit code)
- **tRPC**: Pages Router (`createNextApiHandler`) → App Router (`fetchRequestHandler`)
- **Supabase**: Basic client → Proper SSR with App Router support
- **Session Management**: `getUser()` → `getClaims()` for better performance

## Prerequisites

- Next.js 15+ with hybrid routing (Pages + App Router)
- Existing tRPC setup (Pages Router)
- Supabase Auth configured
- TypeScript project

## Step 1: Add Dependencies

Install the required package for OTP input:

```bash
npm install input-otp
```

**Existing dependencies needed:**
- `@supabase/ssr`
- `@supabase/supabase-js`
- `@trpc/server`
- `@trpc/client`
- `@trpc/react-query`
- `superjson`

## Step 2: Create Supabase Server Client for App Router

Create a new file for the App Router Supabase client:

**File: `src/utils/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // or PUBLISHABLE_KEY
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
```

**Key points:**
- Uses async `cookies()` from next/headers (Next.js 15)
- Proper error handling for Server Components
- Uses `ANON_KEY` or keep existing `PUBLISHABLE_KEY` naming

## Step 3: Create New tRPC Structure

### 3.1 Create tRPC Context

**File: `src/server/trpc/context.ts`**

```typescript
import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type Context = {
  supabase: SupabaseClient;
  user: User | null;
};

export async function createContext(): Promise<Context> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}
```

**Changes from old pattern:**
- No longer needs `opts` parameter (was for Pages Router)
- Returns full `User` object instead of just `{ id }`
- Uses the new server client

### 3.2 Create tRPC Initialization

**File: `src/server/trpc/init.ts`**

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
```

**Changes from old pattern:**
- Added `superjson` transformer
- Uses `TRPCError` instead of throwing generic errors
- Exports `router` instead of `createTRPCRouter`

### 3.3 Create App Router API Handler

Create directory: `src/app/api/trpc/[trpc]/`

**File: `src/app/api/trpc/[trpc]/route.ts`**

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

**Changes from old pattern:**
- Uses `fetchRequestHandler` instead of `createNextApiHandler`
- No more `req/res` parameters, just `Request`
- Exports named GET/POST handlers (App Router style)

## Step 4: Update Root Router

**File: `src/server/api/root.ts`**

```typescript
// OLD
import { createTRPCRouter } from "./trpc";
export const appRouter = createTRPCRouter({
  // ...
});

// NEW
import { router } from "../trpc/init";
export const appRouter = router({
  // ...
});
```

## Step 5: Update All Router Files

Find and replace in all router files (`src/server/api/routers/**/*.ts`):

```bash
# Update imports
find src/server/api/routers -name "*.ts" -type f -exec sed -i '' 's|@/server/api/trpc|@/server/trpc/init|g' {} \;

# Replace createTRPCRouter with router
find src/server/api/routers -name "*.ts" -type f -exec sed -i '' 's/createTRPCRouter/router/g' {} \;
```

**Before:**
```typescript
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const myRouter = createTRPCRouter({
  // procedures...
});
```

**After:**
```typescript
import { router, protectedProcedure } from "@/server/trpc/init";

export const myRouter = router({
  // procedures...
});
```

## Step 6: Update Middleware

**File: `src/utils/supabase/middleware.ts`**

```typescript
// OLD
const {
  data: { user },
} = await supabase.auth.getUser();

// NEW
const { data } = await supabase.auth.getClaims();
const user = data?.claims;
```

Also simplify cookie handling:

```typescript
// OLD
setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) =>
    request.cookies.set(name, value),
  );
  // ...
  cookiesToSet.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options),
  );
}

// NEW
setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
  supabaseResponse = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value));
}
```

**Why `getClaims()`?**
- More performant than `getUser()`
- Returns JWT claims directly
- Recommended by Supabase for middleware

## Step 7: Migrate to Passwordless OTP Authentication

### 7.1 Update Sign-In Page

**File: `src/pages/sign-in.tsx`**

Key changes:

1. **Remove password state:**
```typescript
// OLD
const [password, setPassword] = useState("");

// NEW - Add OTP states
const [magicLinkSent, setMagicLinkSent] = useState(false);
const [otpCode, setOtpCode] = useState("");
const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
```

2. **Update sign-in handler:**
```typescript
// OLD
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// NEW
const { data, error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false, // Only allow existing users
    emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL,
  },
});
```

3. **Add OTP verification:**
```typescript
const handleVerifyOtp = useCallback(async (code: string) => {
  if (code.length !== 6) return;

  const {
    data: { session },
    error,
  } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });

  if (error) {
    toast({
      variant: "destructive",
      title: "Verification failed",
      description: error.message,
    });
    setOtpCode("");
  } else if (session) {
    router.push("/dashboard");
  }
}, [email, supabase, router]);
```

4. **Add OTP input UI:**
```typescript
import { OTPInput, SlotProps, REGEXP_ONLY_DIGITS } from "input-otp";

// In render:
<OTPInput
  maxLength={6}
  value={otpCode}
  onChange={setOtpCode}
  disabled={isVerifyingOtp}
  pattern={REGEXP_ONLY_DIGITS}
  containerClassName="group flex items-center has-[:disabled]:opacity-30"
  render={({ slots }) => (
    <>
      <div className="flex">
        {slots.slice(0, 3).map((slot, idx) => (
          <Slot key={idx} {...slot} />
        ))}
      </div>
      <FakeDash />
      <div className="flex">
        {slots.slice(3).map((slot, idx) => (
          <Slot key={idx} {...slot} />
        ))}
      </div>
    </>
  )}
/>
```

See the full implementation in `src/pages/sign-in.tsx` for complete OTP UI components.

## Step 8: Clean Up Old Files

Delete the old tRPC files:

```bash
rm src/pages/api/trpc/[trpc].ts
rm src/server/api/trpc.ts
```

## Step 9: Update Sign-Up Page (Optional)

If sign-up is disabled, you can either:

1. Keep the sign-up page with a "disabled" message
2. Update it to use OTP flow (same as sign-in but with `shouldCreateUser: true`)

## Step 10: Verify the Migration

### 10.1 Clear Next.js Cache

```bash
rm -rf .next
```

### 10.2 Run Type Check

```bash
npx tsc --noEmit
```

### 10.3 Build the Project

```bash
npm run build
```

**Expected output:**
```
Route (app)
┌ ƒ /api/trpc/[trpc]                         132 B         101 kB
```

### 10.4 Test Authentication Flow

1. Navigate to `/sign-in`
2. Enter email address
3. Check email for 6-digit code
4. Enter code or click magic link
5. Verify redirect to dashboard

## Step 11: Commit Changes

```bash
git add -A
git commit -m "Migrate to passwordless OTP authentication and App Router tRPC"
```

## File Change Summary

### Created (4 files)
- `src/app/api/trpc/[trpc]/route.ts` - App Router tRPC handler
- `src/server/trpc/context.ts` - tRPC context with Supabase
- `src/server/trpc/init.ts` - tRPC initialization
- `src/utils/supabase/server.ts` - Supabase server client

### Deleted (2 files)
- `src/pages/api/trpc/[trpc].ts` - Old Pages Router handler
- `src/server/api/trpc.ts` - Old tRPC initialization

### Modified (varies by project)
- `package.json` - Add input-otp
- `src/pages/sign-in.tsx` - OTP authentication
- `src/utils/supabase/middleware.ts` - Use getClaims()
- `src/server/api/root.ts` - Update imports
- All router files - Update imports

## Common Issues & Solutions

### Issue: "Cannot find module '../../src/pages/api/trpc/[trpc].js'"

**Solution:** Delete `.next` directory and rebuild:
```bash
rm -rf .next
npm run build
```

### Issue: TypeScript errors about missing types

**Solution:** Ensure all imports are updated:
```bash
grep -r "@/server/api/trpc" src/server/api/routers/
# Should return no results after migration
```

### Issue: "Property 'general' does not exist on type 'appConfig'"

**Solution:** Check your `appConfig` structure and update references:
```typescript
// If your config has:
appConfig.name // Use this

// Instead of:
appConfig.general.name // Don't use this unless it exists
```

### Issue: Authentication not working after migration

**Solution:** Check these points:
1. Ensure `NEXT_PUBLIC_APP_URL` is set in `.env`
2. Verify Supabase email templates are configured
3. Check that `shouldCreateUser: false` is set if you only want existing users
4. Verify middleware is redirecting properly

## Benefits of This Migration

1. **Better UX**: Passwordless is faster and more secure
2. **Modern Architecture**: App Router is the future of Next.js
3. **Type Safety**: Full User object in context
4. **Better Performance**: getClaims() is more efficient
5. **Maintainability**: Cleaner separation of concerns
6. **SSR Support**: Proper cookie handling for App Router

## Additional Notes

- The migration maintains backward compatibility with Pages Router pages
- tRPC client configuration (`src/utils/api.ts`) doesn't need changes
- The `_app.tsx` file with `api.withTRPC()` remains unchanged
- Both Pages and App Router can coexist during the transition

## Reference Implementation

This migration was successfully applied to:
- **Source**: vidtempla project (reference implementation)
- **Target**: agentstack project (migration target)
- **Result**: 17 files changed, 430 insertions(+), 293 deletions(-)
- **Build**: ✅ Successful with no errors

For the complete working implementation, see the vidtempla project.
