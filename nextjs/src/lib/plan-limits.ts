/**
 * Plan limits utility
 * Provides functions to check and enforce subscription plan limits
 */

import { TRPCError } from "@trpc/server";
import { PLAN_CONFIG, type PlanTier } from "./polar";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@shared-types/database.types";

/**
 * Get the user's current plan tier
 */
export async function getUserPlanTier(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<PlanTier> {
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_tier")
    .eq("user_id", userId)
    .single();

  return (subscription?.plan_tier as PlanTier) || "free";
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
  supabase: SupabaseClient<Database>
): Promise<{
  canAddVideo: boolean;
  currentCount: number;
  limit: number;
  planTier: PlanTier;
}> {
  // Get user's plan tier
  const planTier = await getUserPlanTier(userId, supabase);
  const features = getPlanFeatures(planTier);

  // Get user's channels
  const { data: channels } = await supabase
    .from("youtube_channels")
    .select("id")
    .eq("user_id", userId);

  const channelIds = channels?.map((c) => c.id) || [];

  // Get current video count
  if (channelIds.length === 0) {
    return {
      canAddVideo: true,
      currentCount: 0,
      limit: features.videoLimit,
      planTier,
    };
  }

  const { count } = await supabase
    .from("youtube_videos")
    .select("id", { count: "exact", head: true })
    .in("channel_id", channelIds);

  const currentCount = count || 0;
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
  supabase: SupabaseClient<Database>
): Promise<{
  canAddChannel: boolean;
  currentCount: number;
  limit: number;
  planTier: PlanTier;
}> {
  // Get user's plan tier
  const planTier = await getUserPlanTier(userId, supabase);
  const features = getPlanFeatures(planTier);

  // Get current channel count
  const { count } = await supabase
    .from("youtube_channels")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const currentCount = count || 0;
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
  supabase: SupabaseClient<Database>
): Promise<void> {
  const result = await checkVideoLimit(userId, supabase);

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
  supabase: SupabaseClient<Database>
): Promise<void> {
  const result = await checkChannelLimit(userId, supabase);

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
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const planTier = await getUserPlanTier(userId, supabase);
  const features = getPlanFeatures(planTier);
  return features.autoUpdate;
}

/**
 * Check if user has access to team features
 */
export async function hasTeamFeaturesAccess(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const planTier = await getUserPlanTier(userId, supabase);
  const features = getPlanFeatures(planTier);
  return 'teamFeatures' in features ? features.teamFeatures : false;
}
