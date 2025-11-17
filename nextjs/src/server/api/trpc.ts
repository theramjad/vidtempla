/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 */
import { User } from "@supabase/supabase-js";
import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";
import { appConfig } from "@/config/app";
import createClient from "@/utils/supabase/api";

interface AuthContext {
  user: User | null;
}

const createInnerTRPCContext = ({ user }: AuthContext) => {
  return {
    user,
  };
};

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  // Create Supabase client from request cookies to get authenticated user
  const supabase = createClient(opts.req, opts.res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return createInnerTRPCContext({ user });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// Check if the user is signed in
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

// Check if user is admin
const isAdmin = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not signed in",
    });
  }

  const user = ctx.user;
  const isAdmin = appConfig.auth.adminEmails.includes(user.email || "");
  if (!isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only administrators can perform this action, your email is: " +
        user.email,
    });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = protectedProcedure.use(isAdmin);
