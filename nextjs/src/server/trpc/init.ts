import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { isSuperAdmin } from "@/lib/admin";

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

const isSuperAdminMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !isSuperAdmin(ctx.user.email)) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const superAdminProcedure = t.procedure.use(isSuperAdminMiddleware);
