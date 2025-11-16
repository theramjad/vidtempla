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
export type PlanTier = "free" | "premium" | "business";

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
 * TODO: Replace these with your actual Polar product/price IDs
 */
export const PLAN_CONFIG = {
  free: {
    name: "Free",
    priceId: null, // Free tier doesn't have a Polar product
    features: {
      videoLimit: 5,
      channelLimit: 1,
      autoUpdate: false,
    },
  },
  premium: {
    name: "Premium",
    priceId: "POLAR_PREMIUM_PRICE_ID", // Replace with actual Polar price ID
    features: {
      videoLimit: Infinity,
      channelLimit: 1,
      autoUpdate: true,
    },
  },
  business: {
    name: "Business",
    priceId: "POLAR_BUSINESS_PRICE_ID", // Replace with actual Polar price ID
    features: {
      videoLimit: Infinity,
      channelLimit: Infinity,
      autoUpdate: true,
      teamFeatures: true,
    },
  },
} as const;
