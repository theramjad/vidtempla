import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, mcp, organization } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import sgMail from "@sendgrid/mail";
import { subscriptions, userCredits, member as memberTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_CONFIG } from "@/lib/stripe";

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function logSendGridError(context: string, to: string, err: unknown): void {
  // SendGrid SDK attaches the actionable reason at err.response.body.errors;
  // the top-level Error message alone usually just says "Forbidden" / "Unauthorized".
  const anyErr = err as {
    code?: number | string;
    message?: string;
    response?: { statusCode?: number; body?: { errors?: Array<{ message?: string; field?: string }> } };
  };
  const status = anyErr?.response?.statusCode ?? anyErr?.code;
  const reasons = anyErr?.response?.body?.errors
    ?.map((e) => `${e.field ?? ""}: ${e.message ?? ""}`.trim())
    .join("; ");
  console.error("[sendgrid] failed", {
    context,
    to,
    status,
    message: anyErr?.message,
    reasons,
    keyPrefix: process.env.SENDGRID_API_KEY?.slice(0, 7),
  });
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.transaction(async (tx) => {
            // Auto-create a personal organization for new users
            const orgId = crypto.randomUUID();
            const slug = (user.email.split("@")[0] ?? "user")
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .slice(0, 30) + "-" + orgId.slice(0, 6);

            await tx.insert(schema.organization).values({
              id: orgId,
              name: user.name || user.email.split("@")[0] || "My Organization",
              slug,
              createdAt: new Date(),
            });

            await tx.insert(memberTable).values({
              id: crypto.randomUUID(),
              organizationId: orgId,
              userId: user.id,
              role: "owner",
              createdAt: new Date(),
            });

            // Create free-tier subscription for the org
            await tx.insert(subscriptions).values({
              organizationId: orgId,
              userId: user.id,
              planTier: "free",
              status: "active",
            });

            // Create credit allocation for the org
            const allocation = PLAN_CONFIG.free.monthlyCredits;
            const now = new Date();
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            await tx.insert(userCredits).values({
              organizationId: orgId,
              userId: user.id,
              balance: allocation,
              monthlyAllocation: allocation,
              periodStart: now,
              periodEnd,
            });
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          await sgMail.send({
            from: "VidTempla <noreply@vidtempla.com>",
            to: email,
            subject: "Sign in to VidTempla",
            html: `<a href="${url}">Click here to sign in</a>`,
          });
        } catch (err) {
          logSendGridError("magic-link", email, err);
          throw err;
        }
      },
    }),
    organization({
      sendInvitationEmail: async ({ email, id, organization: org, inviter }) => {
        const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${id}`;
        const inviterName = escapeHtml(inviter.user.name || inviter.user.email);
        const orgName = escapeHtml(org.name);
        try {
          await sgMail.send({
            from: "VidTempla <noreply@vidtempla.com>",
            to: email,
            subject: `You've been invited to ${org.name} on VidTempla`,
            html: `<p>${inviterName} invited you to join <strong>${orgName}</strong> on VidTempla.</p>
                   <a href="${inviteUrl}">Accept invitation</a>`,
          });
        } catch (err) {
          logSendGridError("org-invite", email, err);
          throw err;
        }
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
