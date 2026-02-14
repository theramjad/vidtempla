/**
 * Plan limits utility
 * Provides functions to check and enforce subscription plan limits
 */

import { TRPCError } from "@trpc/server";
import { PLAN_CONFIG, type PlanTier } from "./stripe";
import type { Database } from "@/db";
import { subscriptions, youtubeChannels, youtubeVideos } from "@/db/schema";
import { eq, count, inArray } from "drizzle-orm";

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
