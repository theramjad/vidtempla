/**
 * API Keys tRPC router
 * Handles API key management: list, create, revoke, and usage stats
 */

import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/init";
import { db } from "@/db";
import { apiKeys, apiRequestLog, userCredits } from "@/db/schema";
import { eq, and, desc, sql, gte, lte, count, like, lt } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
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
      .where(eq(apiKeys.userId, ctx.user.id))
      .orderBy(desc(apiKeys.createdAt));

    return keys;
  }),

  create: protectedProcedure
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

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(apiKeys)
        .where(
          and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id))
        );

      return { success: true };
    }),

  getUsage: protectedProcedure
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
        eq(apiRequestLog.userId, ctx.user.id),
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

  getDetailedUsage: protectedProcedure
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
        eq(apiRequestLog.userId, ctx.user.id),
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
        .orderBy(desc(sql`DATE(${apiRequestLog.createdAt})`));

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

      // Per-endpoint breakdown
      const byEndpoint = await db
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
        .orderBy(desc(count()));

      // Per-key/source breakdown (LEFT JOIN since MCP rows have null apiKeyId)
      const byKey = await db
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
        .orderBy(desc(count()));

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

  getRequestHistory: protectedProcedure
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
        eq(apiRequestLog.userId, ctx.user.id),
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
        filters.push(lt(apiRequestLog.createdAt, new Date(input.cursor)));
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
        .orderBy(desc(apiRequestLog.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

      return { items, cursor: nextCursor, hasMore };
    }),

  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, ctx.user.id));

    if (!row) return null;

    return {
      balance: row.balance,
      monthlyAllocation: row.monthlyAllocation,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
    };
  }),
});
