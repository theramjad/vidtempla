/**
 * Plan limits utility
 * Provides functions to check and enforce subscription plan limits
 */

import { TRPCError } from "@trpc/server";
import { PLAN_CONFIG, type PlanTier } from "./stripe";
import type { Database } from "@/db";
import { db as defaultDb } from "@/db";
import { subscriptions, youtubeChannels, youtubeVideos, userCredits } from "@/db/schema";
import { eq, count, inArray, sql } from "drizzle-orm";

/**
 * Get the user's current plan tier
 */
export async function getUserPlanTier(
  userId: string,
  db: Database
): Promise<PlanTier> {
  const [subscription] = await db
    .select({ planTier: subscriptions.planTier })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  return (subscription?.planTier as PlanTier) || "free";
}

/**
 * Get plan features for a given tier
 */
export function getPlanFeatures(planTier: PlanTier) {
  return PLAN_CONFIG[planTier].features;
}

/**
 * Check if user has reached their video limit
 */
export async function checkVideoLimit(
  userId: string,
  db: Database
): Promise<{
  canAddVideo: boolean;
  currentCount: number;
  limit: number;
  planTier: PlanTier;
}> {
  // Get user's plan tier
  const planTier = await getUserPlanTier(userId, db);
  const features = getPlanFeatures(planTier);

  // Get user's channels
  const channels = await db
    .select({ id: youtubeChannels.id })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.userId, userId));

  const channelIds = channels.map((c) => c.id);

  // Get current video count
  if (channelIds.length === 0) {
    return {
      canAddVideo: true,
      currentCount: 0,
      limit: features.videoLimit,
      planTier,
    };
  }

  const [result] = await db
    .select({ count: count() })
    .from(youtubeVideos)
    .where(inArray(youtubeVideos.channelId, channelIds));

  const currentCount = result?.count || 0;
  const limit = features.videoLimit;

  return {
    canAddVideo: currentCount < limit,
    currentCount,
    limit,
    planTier,
  };
}

/**
 * Check if user has reached their channel limit
 */
export async function checkChannelLimit(
  userId: string,
  db: Database
): Promise<{
  canAddChannel: boolean;
  currentCount: number;
  limit: number;
  planTier: PlanTier;
}> {
  // Get user's plan tier
  const planTier = await getUserPlanTier(userId, db);
  const features = getPlanFeatures(planTier);

  // Get current channel count
  const [result] = await db
    .select({ count: count() })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.userId, userId));

  const currentCount = result?.count || 0;
  const limit = features.channelLimit;

  return {
    canAddChannel: currentCount < limit,
    currentCount,
    limit,
    planTier,
  };
}

/**
 * Enforce video limit - throws error if limit is reached
 */
export async function enforceVideoLimit(
  userId: string,
  db: Database
): Promise<void> {
  const result = await checkVideoLimit(userId, db);

  if (!result.canAddVideo) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You have reached your video limit (${result.limit} videos on the ${result.planTier} plan). Please upgrade your plan to add more videos.`,
    });
  }
}

/**
 * Enforce channel limit - throws error if limit is reached
 */
export async function enforceChannelLimit(
  userId: string,
  db: Database
): Promise<void> {
  const result = await checkChannelLimit(userId, db);

  if (!result.canAddChannel) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You have reached your channel limit (${result.limit} ${result.limit === 1 ? "channel" : "channels"} on the ${result.planTier} plan). Please upgrade your plan to add more channels.`,
    });
  }
}

/**
 * Check if user has access to auto-update feature
 */
export async function hasAutoUpdateAccess(
  userId: string,
  db: Database
): Promise<boolean> {
  const planTier = await getUserPlanTier(userId, db);
  const features = getPlanFeatures(planTier);
  return features.autoUpdate;
}

/**
 * Check if user has access to team features
 */
export async function hasTeamFeaturesAccess(
  userId: string,
  db: Database
): Promise<boolean> {
  const planTier = await getUserPlanTier(userId, db);
  const features = getPlanFeatures(planTier);
  return 'teamFeatures' in features ? features.teamFeatures : false;
}

/**
 * Consume credits atomically. Returns { success, remaining }.
 * If no userCredits row exists (transition period), lazily provisions free-tier credits.
 */
export async function consumeCredits(
  userId: string,
  quotaUnits: number
): Promise<{ success: boolean; remaining: number }> {
  if (quotaUnits <= 0) return { success: true, remaining: Infinity };

  // Check if period has expired and replenish if needed
  const [currentRow] = await defaultDb
    .select({ id: userCredits.id, periodEnd: userCredits.periodEnd })
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  if (currentRow && currentRow.periodEnd <= new Date()) {
    const planTier = await getUserPlanTier(userId, defaultDb);
    const allocation = PLAN_CONFIG[planTier].monthlyCredits;
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await upsertCredits(userId, allocation, now, periodEnd);
  }

  // Try atomic decrement
  const rows = await defaultDb.execute<{ balance: number }>(
    sql`UPDATE user_credits SET balance = balance - ${quotaUnits}, updated_at = NOW() WHERE user_id = ${userId} AND balance >= ${quotaUnits} RETURNING balance`
  );

  if (rows.length > 0) {
    return { success: true, remaining: rows[0]!.balance };
  }

  // No row — lazy provision
  if (!currentRow) {
    const planTier = await getUserPlanTier(userId, defaultDb);
    const allocation = PLAN_CONFIG[planTier].monthlyCredits;
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await upsertCredits(userId, allocation, now, periodEnd);

    const retryRows = await defaultDb.execute<{ balance: number }>(
      sql`UPDATE user_credits SET balance = balance - ${quotaUnits}, updated_at = NOW() WHERE user_id = ${userId} AND balance >= ${quotaUnits} RETURNING balance`
    );
    if (retryRows.length > 0) {
      return { success: true, remaining: retryRows[0]!.balance };
    }
    return { success: false, remaining: 0 };
  }

  // Row exists but insufficient balance
  return { success: false, remaining: 0 };
}

/**
 * Get current credit balance and period info for a user.
 */
export async function getCredits(
  userId: string
): Promise<{
  balance: number;
  monthlyAllocation: number;
  periodStart: Date;
  periodEnd: Date;
} | null> {
  const [row] = await defaultDb
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  if (!row) return null;

  return {
    balance: row.balance,
    monthlyAllocation: row.monthlyAllocation,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
  };
}

/**
 * Insert or update a user's credit allocation.
 */
export async function upsertCredits(userId: string, allocation: number, periodStart: Date, periodEnd: Date) {
  await defaultDb.insert(userCredits).values({
    userId, balance: allocation, monthlyAllocation: allocation, periodStart, periodEnd,
  }).onConflictDoUpdate({
    target: userCredits.userId,
    set: { balance: allocation, monthlyAllocation: allocation, periodStart, periodEnd, updatedAt: new Date() },
  });
}
