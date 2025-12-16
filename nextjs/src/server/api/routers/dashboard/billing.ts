/**
 * Billing tRPC router
 * Handles all billing and subscription-related API procedures
 */

import { z } from "zod";
import { protectedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { stripe } from "@/lib/stripe-server";
import {
  PLAN_CONFIG,
  type PlanTier,
  calculateProratedAmount,
  isUpgrade,
  getFeatureDifference,
  formatCents,
} from "@/lib/stripe";
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
        if (!planConfig.priceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid plan tier or price ID not configured",
          });
        }

        // Get or create subscription record
        let { data: subscription } = await supabaseServer
          .from("subscriptions")
          .select("*")
          .eq("user_id", ctx.user.id)
          .single();

        // Create subscription record if it doesn't exist
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
            console.error("Error creating subscription record:", insertError);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create subscription record",
            });
          }

          subscription = newSubscription;
        }

        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: planConfig.priceId,
              quantity: 1,
            },
          ],
          success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings?checkout=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/pricing`,
          customer_email: ctx.user.email,
          allow_promotion_codes: true,
          metadata: {
            userId: ctx.user.id,
            planTier: input.planTier,
          },
          subscription_data: {
            metadata: {
              userId: ctx.user.id,
              planTier: input.planTier,
            },
          },
        });

        return {
          checkoutUrl: session.url!,
          checkoutId: session.id,
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
        .select("stripe_customer_id")
        .eq("user_id", ctx.user.id)
        .single();

      if (!subscription?.stripe_customer_id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found",
        });
      }

      // Create Stripe Customer Portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings`,
      });

      return {
        portalUrl: portalSession.url,
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

      // Check if subscription has a Stripe subscription ID
      if (!subscription.stripe_subscription_id) {
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
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
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

        // Get target price ID
        const targetConfig = PLAN_CONFIG[targetTier];
        if (!targetConfig.priceId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Target plan price ID not configured",
          });
        }

        // Get current subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );

        const firstItem = stripeSubscription.items.data[0];
        if (!firstItem) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Subscription has no items",
          });
        }

        // Update subscription with Stripe
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          items: [
            {
              id: firstItem.id,
              price: targetConfig.priceId,
            },
          ],
          // Proration behavior:
          // - For upgrades: charge immediately (create_prorations + always_invoice)
          // - For downgrades: apply credit at next invoice (create_prorations)
          proration_behavior: "create_prorations",
          billing_cycle_anchor: isUpgrading ? "now" : "unchanged",
          ...(isUpgrading && {
            // For upgrades, invoice immediately
            payment_behavior: "default_incomplete",
          }),
        });

        // Note: The actual plan tier update will happen via webhook
        // when Stripe sends subscription.updated event

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

        // Handle specific Stripe errors
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (errorMessage.includes("locked")) {
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
