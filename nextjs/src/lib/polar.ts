import { Polar } from "@polar-sh/sdk";

/**
 * Client-side Polar instance for checkout and public operations
 * This can be used in both client and server contexts
 */
export const polarClient = new Polar({
  server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

/**
 * Polar organization ID for creating checkout sessions
 */
export const POLAR_ORGANIZATION_ID =
  process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID;

if (
  !POLAR_ORGANIZATION_ID &&
  typeof window !== "undefined"
) {
  console.warn(
    "NEXT_PUBLIC_POLAR_ORGANIZATION_ID is not set - checkout will not work"
  );
}

/**
 * Plan tier type definition
 */
export type PlanTier = "free" | "pro" | "business";

/**
 * Subscription status type definition
 */
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete";

/**
 * Plan configuration with Polar product IDs
 * NOTE: These should be your Polar Product IDs from https://polar.sh
 * You can find these in your Polar dashboard under Products
 */
export const PLAN_CONFIG = {
  free: {
    name: "Free",
    productId: null, // Free tier doesn't have a Polar product
    priceMonthly: 0,
    features: {
      videoLimit: 5,
      channelLimit: 1,
      autoUpdate: false,
    },
  },
  pro: {
    name: "Pro",
    productId: process.env.POLAR_PRO_PRODUCT_ID || null,
    priceMonthly: 2000, // $20.00 in cents
    features: {
      videoLimit: Infinity,
      channelLimit: 1,
      autoUpdate: true,
    },
  },
  business: {
    name: "Business",
    productId: process.env.POLAR_BUSINESS_PRODUCT_ID || null,
    priceMonthly: 10000, // $100.00 in cents
    features: {
      videoLimit: Infinity,
      channelLimit: Infinity,
      autoUpdate: true,
      teamFeatures: true,
    },
  },
} as const;

/**
 * Plan rank for comparison (higher = more features)
 */
const PLAN_RANKS: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

/**
 * Get the numeric rank of a plan tier
 */
export function getPlanRank(tier: PlanTier): number {
  return PLAN_RANKS[tier];
}

/**
 * Check if changing from one plan to another is an upgrade
 */
export function isUpgrade(from: PlanTier, to: PlanTier): boolean {
  return getPlanRank(to) > getPlanRank(from);
}

/**
 * Calculate the prorated amount for an upgrade
 * Returns amount in cents
 */
export function calculateProratedAmount(
  currentPriceMonthly: number,
  newPriceMonthly: number,
  currentPeriodEnd: Date
): number {
  const now = new Date();
  const endDate = new Date(currentPeriodEnd);

  // Calculate days remaining in current period
  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  // Approximate days in a month
  const daysInMonth = 30;

  // Calculate daily price difference
  const dailyDiff = (newPriceMonthly - currentPriceMonthly) / daysInMonth;

  // Calculate prorated amount
  const proratedAmount = Math.max(0, Math.round(dailyDiff * daysRemaining));

  return proratedAmount;
}

/**
 * Format cents as a currency string
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Feature descriptions for UI display
 */
export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  videoLimit: "Video limit",
  channelLimit: "Channel limit",
  autoUpdate: "Automatic description updates",
  teamFeatures: "Team collaboration features",
};

/**
 * Get the features that will be gained or lost when changing plans
 */
export function getFeatureDifference(
  from: PlanTier,
  to: PlanTier
): { gaining: string[]; losing: string[] } {
  const fromFeatures = PLAN_CONFIG[from].features;
  const toFeatures = PLAN_CONFIG[to].features;

  const gaining: string[] = [];
  const losing: string[] = [];

  // Check video limit
  if (toFeatures.videoLimit > fromFeatures.videoLimit) {
    gaining.push(toFeatures.videoLimit === Infinity ? "Unlimited videos" : `Up to ${toFeatures.videoLimit} videos`);
  } else if (toFeatures.videoLimit < fromFeatures.videoLimit) {
    losing.push(fromFeatures.videoLimit === Infinity ? "Unlimited videos" : `Up to ${fromFeatures.videoLimit} videos`);
  }

  // Check channel limit
  if (toFeatures.channelLimit > fromFeatures.channelLimit) {
    gaining.push(toFeatures.channelLimit === Infinity ? "Unlimited channels" : `Up to ${toFeatures.channelLimit} channels`);
  } else if (toFeatures.channelLimit < fromFeatures.channelLimit) {
    losing.push(fromFeatures.channelLimit === Infinity ? "Unlimited channels" : `Up to ${fromFeatures.channelLimit} channels`);
  }

  // Check auto update
  if (toFeatures.autoUpdate && !fromFeatures.autoUpdate) {
    gaining.push("Automatic description updates");
  } else if (!toFeatures.autoUpdate && fromFeatures.autoUpdate) {
    losing.push("Automatic description updates");
  }

  // Check team features
  const fromTeam = "teamFeatures" in fromFeatures ? fromFeatures.teamFeatures : false;
  const toTeam = "teamFeatures" in toFeatures ? toFeatures.teamFeatures : false;

  if (toTeam && !fromTeam) {
    gaining.push("Team collaboration features");
  } else if (!toTeam && fromTeam) {
    losing.push("Team collaboration features");
  }

  return { gaining, losing };
}
