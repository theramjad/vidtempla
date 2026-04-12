import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { isSuperAdmin } from "@/lib/admin";
import { member } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause as
      | { driftMeta?: { driftedVideoIds: string[]; driftDetectedAt: string | null; latestManualEditHistoryId: string | null } }
      | undefined;
    return {
      ...shape,
      data: {
        ...shape.data,
        ...(cause?.driftMeta ? { driftMeta: cause.driftMeta } : {}),
      },
    };
  },
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

// Org-scoped procedure: verifies user is a member of the active organization
const isOrgMember = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.organizationId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
  }

  const [membership] = await ctx.db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, ctx.organizationId),
        eq(member.userId, ctx.user.id)
      )
    )
    .limit(1);

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      organizationId: ctx.organizationId,
      orgRole: membership.role,
    },
  });
});

export const orgProcedure = t.procedure.use(isOrgMember);

// Org admin procedure: chains from orgProcedure, just checks role
const isOrgAdminCheck = t.middleware(async ({ ctx, next }) => {
  const role = (ctx as { orgRole?: string }).orgRole;
  if (role !== "owner" && role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin or owner role required" });
  }
  return next({ ctx });
});

export const orgAdminProcedure = orgProcedure.use(isOrgAdminCheck);

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
