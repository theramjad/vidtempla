import type { NextApiRequest, NextApiResponse } from "next";
import { Webhooks } from "@polar-sh/nextjs";
import { POLAR_WEBHOOK_SECRET } from "@/lib/polar-server";
import { supabaseServer } from "@/lib/clients/supabase";
import type { PlanTier, SubscriptionStatus } from "@/lib/polar";

/**
 * Polar webhook handler using @polar-sh/nextjs helper
 * Provides proper type-safe event handling
 */
export const POST = Webhooks({
    webhookSecret: POLAR_WEBHOOK_SECRET!,

    onSubscriptionCreated: async (payload) => {
        console.log(`Processing subscription.created for customer: ${payload.data.customerId}`);
        await handleSubscriptionEvent(payload.data, "subscription.created");
    },

    onSubscriptionUpdated: async (payload) => {
        console.log(`Processing subscription.updated for customer: ${payload.data.customerId}`);
        await handleSubscriptionEvent(payload.data, "subscription.updated");
    },

    onSubscriptionActive: async (payload) => {
        console.log(`Processing subscription.active for customer: ${payload.data.customerId}`);
        await handleSubscriptionEvent(payload.data, "subscription.active");
    },

    onSubscriptionCanceled: async (payload) => {
        console.log(`Processing subscription.canceled for subscription: ${payload.data.id}`);

        await supabaseServer
            .from("subscriptions")
            .update({
                status: "canceled",
            })
            .eq("polar_subscription_id", payload.data.id);

        console.log(`Subscription ${payload.data.id} canceled`);
    },

    onOrderCreated: async (payload) => {
        const order = payload.data as {
            id: string;
            customerId: string;
            subscriptionId?: string;
            amount?: number;
            currency?: string;
        };
        console.log(`Processing order.created for customer: ${order.customerId}`);

        // Find user by polar_customer_id
        const { data: userSubscription } = await supabaseServer
            .from("subscriptions")
            .select("user_id, id")
            .eq("polar_customer_id", order.customerId)
            .single();

        if (!userSubscription) {
            console.warn(`No user found for polar_customer_id: ${order.customerId}`);
            return;
        }

        // Create order record
        await supabaseServer.from("orders").insert({
            user_id: userSubscription.user_id,
            polar_order_id: order.id,
            polar_customer_id: order.customerId,
            amount: order.amount || 0,
            currency: order.currency || "USD",
            status: "pending",
            subscription_id: order.subscriptionId
                ? userSubscription.id
                : (null as never),
        });

        console.log(`Order ${order.id} created for user ${userSubscription.user_id}`);
    },

    onOrderPaid: async (payload) => {
        console.log(`Processing order.paid for order: ${payload.data.id}`);

        await supabaseServer
            .from("orders")
            .update({
                status: "paid",
            })
            .eq("polar_order_id", payload.data.id);

        console.log(`Order ${payload.data.id} marked as paid`);
    },

    onOrderRefunded: async (payload) => {
        console.log(`Processing order.refunded for order: ${payload.data.id}`);

        await supabaseServer
            .from("orders")
            .update({
                status: "refunded",
            })
            .eq("polar_order_id", payload.data.id);

        console.log(`Order ${payload.data.id} marked as refunded`);
    },

    onPayload: async (payload) => {
        // Log all webhook events for debugging
        console.log(`Received webhook event: ${payload.type}`);

        // Store webhook event for idempotency and audit trail
        const eventId = `${payload.type}-${Date.now()}`;

        await supabaseServer.from("webhook_events").upsert({
            event_id: eventId,
            event_type: payload.type,
            payload: payload.data as never,
            processed: true,
            processed_at: new Date().toISOString(),
        });
    },
});

/**
 * Handle subscription events (created, updated, active)
 */
async function handleSubscriptionEvent(
    subscription: {
        id: string;
        customerId: string;
        product: { name: string };
        status: string;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        metadata?: { userId?: string };
    },
    eventType: string
) {
    // Map product name to plan tier
    const planTier = mapProductToPlanTier(subscription.product.name);
    const status = mapSubscriptionStatus(subscription.status);

    console.log(`Processing ${eventType} for customer: ${subscription.customerId}, plan: ${planTier}`);

    // Try to find subscription by polar_customer_id first, then by user_id from metadata
    let existingSubscription = await supabaseServer
        .from("subscriptions")
        .select("id, user_id")
        .eq("polar_customer_id", subscription.customerId)
        .single();

    // If not found by polar_customer_id, try to find by user_id from metadata
    if (!existingSubscription.data && subscription.metadata?.userId) {
        console.log(`Trying to find subscription by userId: ${subscription.metadata.userId}`);
        existingSubscription = await supabaseServer
            .from("subscriptions")
            .select("id, user_id")
            .eq("user_id", subscription.metadata.userId)
            .single();
    }

    if (existingSubscription.data) {
        // Update existing subscription
        await supabaseServer
            .from("subscriptions")
            .update({
                polar_subscription_id: subscription.id,
                polar_customer_id: subscription.customerId,
                plan_tier: planTier,
                status: status,
                current_period_start: subscription.currentPeriodStart?.toISOString() ?? null,
                current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
                cancel_at_period_end: subscription.cancelAtPeriodEnd,
            })
            .eq("id", existingSubscription.data.id);

        console.log(
            `Updated subscription ${existingSubscription.data.id} for user ${existingSubscription.data.user_id} to ${planTier}`
        );
    } else {
        console.warn(
            `No subscription found for polar_customer_id: ${subscription.customerId} or userId: ${subscription.metadata?.userId}`
        );
    }
}

/**
 * Map Polar product name to plan tier
 */
function mapProductToPlanTier(productName: string): PlanTier {
    const name = productName.toLowerCase();
    if (name.includes("pro")) return "pro";
    if (name.includes("business")) return "business";
    return "free";
}

/**
 * Map Polar subscription status to our status enum
 */
function mapSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
        case "active":
            return "active";
        case "canceled":
            return "canceled";
        case "past_due":
            return "past_due";
        case "trialing":
            return "trialing";
        case "incomplete":
            return "incomplete";
        default:
            return "active";
    }
}