/**
 * Billing tRPC router
 * Handles all billing and subscription-related API procedures
 */

import { z } from "zod";
import { protectedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { polar } from "@/lib/polar-server";
import {
  PLAN_CONFIG,
  type PlanTier,
  calculateProratedAmount,
  isUpgrade,
  getFeatureDifference,
  formatCents,
} from "@/lib/polar";
import { supabaseServer } from "@/lib/clients/supabase";
import { router } from "@/server/trpc/init";

export const billingRouter = router({
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
          externalCustomerId: ctx.user.id,
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

  /**
   * Get upgrade preview with prorated amount calculation
   */
  getUpgradePreview: protectedProcedure
    .input(
      z.object({
        targetPlanTier: z.enum(["pro", "business"]),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get current subscription
      const { data: subscription } = await supabaseServer
        .from("subscriptions")
        .select("*")
        .eq("user_id", ctx.user.id)
        .single();

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No subscription found",
        });
      }

      const currentTier = subscription.plan_tier as PlanTier;
      const targetTier = input.targetPlanTier;

      // Get plan configurations
      const currentConfig = PLAN_CONFIG[currentTier];
      const targetConfig = PLAN_CONFIG[targetTier];

      // Check if this is actually an upgrade
      const isUpgrading = isUpgrade(currentTier, targetTier);

      // Calculate prorated amount if upgrading and has billing period
      let proratedAmount = 0;
      if (isUpgrading && subscription.current_period_end) {
        proratedAmount = calculateProratedAmount(
          currentConfig.priceMonthly,
          targetConfig.priceMonthly,
          new Date(subscription.current_period_end)
        );
      }

      // Get feature differences
      const featureDiff = getFeatureDifference(currentTier, targetTier);

      return {
        currentPlan: {
          tier: currentTier,
          name: currentConfig.name,
          priceMonthly: currentConfig.priceMonthly,
        },
        targetPlan: {
          tier: targetTier,
          name: targetConfig.name,
          priceMonthly: targetConfig.priceMonthly,
        },
        isUpgrade: isUpgrading,
        proratedAmount,
        proratedAmountFormatted: formatCents(proratedAmount),
        newMonthlyPriceFormatted: formatCents(targetConfig.priceMonthly),
        currentPeriodEnd: subscription.current_period_end,
        featuresGaining: featureDiff.gaining,
        featuresLosing: featureDiff.losing,
      };
    }),

  /**
   * Update subscription to a different plan
   */
  updateSubscription: protectedProcedure
    .input(
      z.object({
        targetPlanTier: z.enum(["free", "pro", "business"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current subscription
      const { data: subscription } = await supabaseServer
        .from("subscriptions")
        .select("*")
        .eq("user_id", ctx.user.id)
        .single();

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No subscription found. Please subscribe first.",
        });
      }

      // Check if subscription has a Polar subscription ID
      if (!subscription.polar_subscription_id) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active paid subscription found. Please subscribe first.",
        });
      }

      // Check subscription status
      if (subscription.status !== "active") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot change plan while subscription is ${subscription.status}. Please contact support.`,
        });
      }

      const currentTier = subscription.plan_tier as PlanTier;
      const targetTier = input.targetPlanTier;

      // Check if same plan
      if (currentTier === targetTier) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already on this plan",
        });
      }

      const isUpgrading = isUpgrade(currentTier, targetTier);

      try {
        // Handle downgrade to free (cancel subscription)
        if (targetTier === "free") {
          await polar.subscriptions.update({
            id: subscription.polar_subscription_id,
            subscriptionUpdate: {
              cancelAtPeriodEnd: true,
            },
          });

          // Update local subscription to reflect pending cancellation
          await supabaseServer
            .from("subscriptions")
            .update({
              cancel_at_period_end: true,
            })
            .eq("id", subscription.id);

          return {
            success: true,
            message: `Your subscription will be canceled at the end of the current billing period`,
            effectiveDate: subscription.current_period_end,
            isImmediate: false,
          };
        }

        // Get target product ID
        const targetConfig = PLAN_CONFIG[targetTier];
        if (!targetConfig.productId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Target plan product ID not configured",
          });
        }

        // Update subscription with Polar
        await polar.subscriptions.update({
          id: subscription.polar_subscription_id,
          subscriptionUpdate: {
            productId: targetConfig.productId,
            // Use "invoice" for upgrades (charge immediately)
            // Use "prorate" for downgrades (credit on next invoice)
            prorationBehavior: isUpgrading ? "invoice" : "prorate",
          },
        });

        // Note: The actual plan tier update will happen via webhook
        // when Polar sends subscription.updated event

        if (isUpgrading) {
          return {
            success: true,
            message: `Successfully upgraded to ${targetConfig.name}! Your new features are available now.`,
            effectiveDate: new Date().toISOString(),
            isImmediate: true,
          };
        } else {
          return {
            success: true,
            message: `Your plan will change to ${targetConfig.name} at the end of your billing period`,
            effectiveDate: subscription.current_period_end,
            isImmediate: false,
          };
        }
      } catch (error) {
        console.error("Subscription update error:", error);

        // Handle specific Polar errors
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (errorMessage.includes("subscription_locked")) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Your subscription is currently being modified. Please try again in a few moments.",
          });
        }

        if (errorMessage.includes("payment")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Payment failed. Please update your payment method and try again.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update subscription. Please try again later.",
        });
      }
    }),
});
