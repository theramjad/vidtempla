/**
 * Billing tRPC router
 * Handles all billing and subscription-related API procedures
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { polar } from "@/lib/polar-server";
import { PLAN_CONFIG, type PlanTier } from "@/lib/polar";
import { supabaseServer } from "@/lib/clients/supabase";

export const billingRouter = createTRPCRouter({
  /**
   * Get the current user's subscription plan
   */
  getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
    const { data: subscription, error } = await supabaseServer
      .from("subscriptions")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows found"
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }

    // If no subscription exists, create a free tier subscription
    if (!subscription) {
      const { data: newSubscription, error: insertError } = await supabaseServer
        .from("subscriptions")
        .insert({
          user_id: ctx.user.id,
          plan_tier: "free",
          status: "active",
        })
        .select()
        .single();

      if (insertError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: insertError.message,
        });
      }

      return newSubscription;
    }

    return subscription;
  }),

  /**
   * Create a checkout session for upgrading to a paid plan
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        planTier: z.enum(["pro", "business"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get plan configuration
        const planConfig = PLAN_CONFIG[input.planTier];
        if (!planConfig.productId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid plan tier or product ID not configured",
          });
        }

        // Get or create subscription record to store polar_customer_id
        const { data: subscription } = await supabaseServer
          .from("subscriptions")
          .select("*")
          .eq("user_id", ctx.user.id)
          .single();

        // Create checkout session with Polar
        const checkoutSession = await polar.checkouts.create({
          products: [planConfig.productId],
          successUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings?checkout=success`,
          customerEmail: ctx.user.email,
          metadata: {
            userId: ctx.user.id,
            planTier: input.planTier,
          },
        });

        // If we have a customer ID from the checkout, update our subscription record
        if (checkoutSession.customerId && subscription) {
          await supabaseServer
            .from("subscriptions")
            .update({
              polar_customer_id: checkoutSession.customerId,
            })
            .eq("id", subscription.id);
        }

        return {
          checkoutUrl: checkoutSession.url,
          checkoutId: checkoutSession.id,
        };
      } catch (error) {
        console.error("Checkout session creation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create checkout session",
        });
      }
    }),

  /**
   * Get the customer portal URL for managing subscriptions
   */
  getCustomerPortalUrl: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: subscription } = await supabaseServer
        .from("subscriptions")
        .select("polar_customer_id")
        .eq("user_id", ctx.user.id)
        .single();

      if (!subscription?.polar_customer_id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found",
        });
      }

      // Generate customer portal session
      const portalSession = await polar.customerSessions.create({
        customerId: subscription.polar_customer_id,
      });

      return {
        portalUrl: portalSession.customerPortalUrl,
      };
    } catch (error) {
      console.error("Customer portal URL error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to get customer portal URL",
      });
    }
  }),

  /**
   * Get current usage statistics
   */
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    // Get channel count
    const { data: channels, error: channelsError } = await supabaseServer
      .from("youtube_channels")
      .select("id")
      .eq("user_id", ctx.user.id);

    if (channelsError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: channelsError.message,
      });
    }

    // Get video count across all user's channels
    const { data: videos, error: videosError } = await supabaseServer
      .from("youtube_videos")
      .select("id")
      .in(
        "channel_id",
        channels?.map((c) => c.id) || []
      );

    if (videosError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: videosError.message,
      });
    }

    // Get current plan
    const { data: subscription } = await supabaseServer
      .from("subscriptions")
      .select("plan_tier")
      .eq("user_id", ctx.user.id)
      .single();

    const planTier = (subscription?.plan_tier as PlanTier) || "free";
    const limits = PLAN_CONFIG[planTier].features;

    return {
      channels: {
        current: channels?.length || 0,
        limit: limits.channelLimit,
      },
      videos: {
        current: videos?.length || 0,
        limit: limits.videoLimit,
      },
      planTier,
    };
  }),

  /**
   * Get payment history (orders)
   */
  getOrders: protectedProcedure.query(async ({ ctx }) => {
    const { data: orders, error } = await supabaseServer
      .from("orders")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }

    return orders;
  }),
});
