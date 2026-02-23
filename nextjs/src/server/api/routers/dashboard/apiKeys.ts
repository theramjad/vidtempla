/**
 * API Keys tRPC router
 * Handles API key management: list, create, revoke, and usage stats
 */

import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/init";
import { db } from "@/db";
import { apiKeys, apiRequestLog } from "@/db/schema";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
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
          expiresAt,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
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

      // Per-key breakdown
      const byKey = await db
        .select({
          apiKeyId: apiRequestLog.apiKeyId,
          keyName: apiKeys.name,
          requests: count().as("requests"),
          quotaUnits:
            sql<number>`COALESCE(SUM(${apiRequestLog.quotaUnits}), 0)`.as(
              "quota_units"
            ),
        })
        .from(apiRequestLog)
        .innerJoin(apiKeys, eq(apiRequestLog.apiKeyId, apiKeys.id))
        .where(and(...filters))
        .groupBy(apiRequestLog.apiKeyId, apiKeys.name)
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
});
