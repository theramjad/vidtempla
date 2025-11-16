import { Polar } from "@polar-sh/sdk";

if (!process.env.POLAR_ACCESS_TOKEN) {
  throw new Error("POLAR_ACCESS_TOKEN is not set");
}

/**
 * Server-side Polar client for making API calls
 * This should only be used in server-side contexts (API routes, tRPC procedures, etc.)
 */
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

/**
 * Webhook secret for validating Polar webhook signatures
 */
export const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

if (!POLAR_WEBHOOK_SECRET) {
  console.warn("POLAR_WEBHOOK_SECRET is not set - webhook validation will fail");
}
