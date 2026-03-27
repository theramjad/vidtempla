/**
 * API Keys tRPC router
 * Handles API key management: list, create, revoke, and usage stats
 */

import { z } from "zod";
import { orgProcedure, router } from "@/server/trpc/init";
import { db } from "@/db";
import { apiKeys, apiRequestLog } from "@/db/schema";
import { eq, and, desc, sql, gte, lte, count, like, lt, or } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";
import { getCredits } from "@/lib/plan-limits";

export const apiKeysRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permission: apiKeys.permission,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, ctx.organizationId))
      .orderBy(desc(apiKeys.createdAt));

    return keys;
  }),

  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        expiresInDays: z.number().int().positive().optional(),
        permission: z.enum(["read", "read-write"]).default("read"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { plaintext, hash, prefix } = generateApiKey();

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const [key] = await db
        .insert(apiKeys)
        .values({
          userId: ctx.user.id,
          organizationId: ctx.organizationId,
          name: input.name,
          keyHash: hash,
          keyPrefix: prefix,
          permission: input.permission,
          expiresAt,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          permission: apiKeys.permission,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt,
        });

      return {
        ...key,
        plaintext,
      };
    }),

  revoke: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(apiKeys)
        .where(
          and(eq(apiKeys.id, input.id), eq(apiKeys.organizationId, ctx.organizationId))
        );

      return { success: true };
    }),

  getUsage: orgProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const start = input.startDate
        ? new Date(input.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input.endDate ? new Date(input.endDate) : now;

      const filters = [
        eq(apiRequestLog.organizationId, ctx.organizationId),
        gte(apiRequestLog.createdAt, start),
        lte(apiRequestLog.createdAt, end),
      ];

      // Per-day counts
      const daily = await db
        .select({
          date: sql<string>`DATE(${apiRequestLog.createdAt})`.as("date"),
          requestCount: count().as("request_count"),
          quotaUnits:
            sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
              "quota_units"
            ),
        })
        .from(apiRequestLog)
        .where(and(...filters))
        .groupBy(sql`DATE(${apiRequestLog.createdAt})`)
        .orderBy(sql`DATE(${apiRequestLog.createdAt})`);

      // Totals
      const [totals] = await db
        .select({
          requests: count().as("requests"),
          quotaUnits:
            sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
              "quota_units"
            ),
        })
        .from(apiRequestLog)
        .where(and(...filters));

      return {
        daily,
        totals: {
          requests: totals?.requests ?? 0,
          quotaUnits: totals?.quotaUnits ?? 0,
        },
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      };
    }),

  getDetailedUsage: orgProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const start = input.startDate
        ? new Date(input.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input.endDate ? new Date(input.endDate) : now;

      const filters = [
        eq(apiRequestLog.organizationId, ctx.organizationId),
        gte(apiRequestLog.createdAt, start),
        lte(apiRequestLog.createdAt, end),
      ];

      const [daily, [totals], byEndpoint, byKey] = await Promise.all([
        // Per-day counts
        db
          .select({
            date: sql<string>`DATE(${apiRequestLog.createdAt})`.as("date"),
            requestCount: count().as("request_count"),
            quotaUnits:
              sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
                "quota_units"
              ),
          })
          .from(apiRequestLog)
          .where(and(...filters))
          .groupBy(sql`DATE(${apiRequestLog.createdAt})`)
          .orderBy(desc(sql`DATE(${apiRequestLog.createdAt})`)),

        // Totals
        db
          .select({
            requests: count().as("requests"),
            quotaUnits:
              sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
                "quota_units"
              ),
          })
          .from(apiRequestLog)
          .where(and(...filters)),

        // Per-endpoint breakdown
        db
          .select({
            endpoint: apiRequestLog.endpoint,
            requests: count().as("requests"),
            quotaUnits:
              sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
                "quota_units"
              ),
          })
          .from(apiRequestLog)
          .where(and(...filters))
          .groupBy(apiRequestLog.endpoint)
          .orderBy(desc(count())),

        // Per-key/source breakdown (LEFT JOIN since MCP rows have null apiKeyId)
        db
          .select({
            apiKeyId: apiRequestLog.apiKeyId,
            source: apiRequestLog.source,
            keyName: sql<string>`COALESCE(${apiKeys.name}, 'MCP')`.as("key_name"),
            requests: count().as("requests"),
            quotaUnits:
              sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
                "quota_units"
              ),
          })
          .from(apiRequestLog)
          .leftJoin(apiKeys, eq(apiRequestLog.apiKeyId, apiKeys.id))
          .where(and(...filters))
          .groupBy(apiRequestLog.apiKeyId, apiRequestLog.source, apiKeys.name)
          .orderBy(desc(count())),
      ]);

      return {
        daily,
        totals: {
          requests: totals?.requests ?? 0,
          quotaUnits: totals?.quotaUnits ?? 0,
        },
        byEndpoint,
        byKey,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      };
    }),

  getRequestHistory: orgProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        source: z.enum(["rest", "mcp", "all"]).default("all"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        endpointSearch: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const start = input.startDate
        ? new Date(input.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input.endDate ? new Date(input.endDate) : now;

      const filters = [
        eq(apiRequestLog.organizationId, ctx.organizationId),
        gte(apiRequestLog.createdAt, start),
        lte(apiRequestLog.createdAt, end),
      ];

      if (input.source !== "all") {
        filters.push(eq(apiRequestLog.source, input.source));
      }
      if (input.endpointSearch) {
        filters.push(like(apiRequestLog.endpoint, `%${input.endpointSearch}%`));
      }
      if (input.cursor) {
        const [cursorDate, cursorId] = input.cursor.split("|");
        filters.push(
          or(
            lt(apiRequestLog.createdAt, new Date(cursorDate!)),
            and(eq(apiRequestLog.createdAt, new Date(cursorDate!)), lt(apiRequestLog.id, cursorId!))
          )!
        );
      }

      const rows = await db
        .select({
          id: apiRequestLog.id,
          createdAt: apiRequestLog.createdAt,
          source: apiRequestLog.source,
          endpoint: apiRequestLog.endpoint,
          method: apiRequestLog.method,
          statusCode: apiRequestLog.statusCode,
          quotaUnits: apiRequestLog.quotaUnits,
          keyName: sql<string | null>`${apiKeys.name}`.as("key_name"),
        })
        .from(apiRequestLog)
        .leftJoin(apiKeys, eq(apiRequestLog.apiKeyId, apiKeys.id))
        .where(and(...filters))
        .orderBy(desc(apiRequestLog.createdAt), desc(apiRequestLog.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null;

      return { items, cursor: nextCursor, hasMore };
    }),

  getCreditBalance: orgProcedure.query(async ({ ctx }) => {
    const credits = await getCredits(ctx.organizationId);
    if (!credits) return null;
    return {
      balance: credits.balance,
      monthlyAllocation: credits.monthlyAllocation,
      periodStart: credits.periodStart.toISOString(),
      periodEnd: credits.periodEnd.toISOString(),
    };
  }),
});
