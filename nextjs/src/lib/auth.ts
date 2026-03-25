import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, mcp } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
  ].filter(Boolean),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: "VidTempla <noreply@vidtempla.com>",
          to: email,
          subject: "Sign in to VidTempla",
          html: `<a href="${url}">Click here to sign in</a>`,
        });
      },
    }),
    mcp({
      loginPage: "/sign-in",
      oidcConfig: {
        loginPage: "/sign-in",
        consentPage: "/auth/consent",
        allowDynamicClientRegistration: true,
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
