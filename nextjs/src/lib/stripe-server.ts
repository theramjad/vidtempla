import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

/**
 * Server-side Stripe client for making API calls
 * This should only be used in server-side contexts (API routes, tRPC procedures, etc.)
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover",
  typescript: true,
  appInfo: {
    name: "VidTempla",
    version: "1.0.0",
  },
});

/**
 * Webhook secret for validating Stripe webhook signatures
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn("STRIPE_WEBHOOK_SECRET is not set - webhook validation will fail");
}
