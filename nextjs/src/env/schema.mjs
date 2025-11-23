// @ts-check
import { z } from "zod";

/**
 * Specify your server-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 */
export const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  CLOUDFLARE_TUNNEL_URL: z.string().optional().default("http://localhost:3000"),

  // YouTube OAuth
  YOUTUBE_CLIENT_ID: z.string(),
  YOUTUBE_CLIENT_SECRET: z.string(),
  YOUTUBE_REDIRECT_URI: z.string().url(),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),

  // RapidAPI (optional)
  RAPID_API_KEY: z.string().optional(),

  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  // Inngest (only required in production)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Polar
  POLAR_ACCESS_TOKEN: z.string(),
  POLAR_WEBHOOK_SECRET: z.string(),
  POLAR_PRO_PRODUCT_ID: z.string(),
  POLAR_BUSINESS_PRODUCT_ID: z.string(),

  // AI
  GEMINI_API_KEY: z.string(),
});

/**
 * You can't destruct `process.env` as a regular object in the Next.js
 * middleware, so you have to do it manually here.
 * @type {{ [k in keyof z.input<typeof serverSchema>]: string | undefined }}
 */
export const serverEnv = {
  NODE_ENV: process.env.NODE_ENV,
  CLOUDFLARE_TUNNEL_URL: process.env.CLOUDFLARE_TUNNEL_URL,

  // YouTube OAuth
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI,

  // Encryption
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // RapidAPI
  RAPID_API_KEY: process.env.RAPID_API_KEY,

  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Inngest
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,

  // Polar
  POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
  POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
  POLAR_PRO_PRODUCT_ID: process.env.POLAR_PRO_PRODUCT_ID,
  POLAR_BUSINESS_PRODUCT_ID: process.env.POLAR_BUSINESS_PRODUCT_ID,

  // AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

/**
 * Specify your client-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 * To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
export const clientSchema = z.object({
  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),

  // Polar
  NEXT_PUBLIC_POLAR_ORGANIZATION_ID: z.string(),

  // PostHog
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
});

/**
 * You can't destruct `process.env` as a regular object, so you have to do
 * it manually here. This is because Next.js evaluates this at build time,
 * and only used environment variables are included in the build.
 * @type {{ [k in keyof z.input<typeof clientSchema>]: string | undefined }}
 */
export const clientEnv = {
  // App URL
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,

  // Polar
  NEXT_PUBLIC_POLAR_ORGANIZATION_ID: process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID,

  // PostHog
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
};
