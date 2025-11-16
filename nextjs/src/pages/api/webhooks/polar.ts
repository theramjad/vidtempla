import type { NextApiRequest, NextApiResponse } from "next";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { POLAR_WEBHOOK_SECRET } from "@/lib/polar-server";
import { supabaseServer } from "@/lib/clients/supabase";
import type { PlanTier, SubscriptionStatus } from "@/lib/polar";

/**
 * Read raw body from request
 */
async function getRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Polar webhook handler
 * Processes webhook events from Polar for subscriptions and orders
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!POLAR_WEBHOOK_SECRET) {
    console.error("POLAR_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  try {
    // Get raw body for signature validation
    const rawBody = await getRawBody(req);
    const signature = req.headers["webhook-signature"] as string;

    if (!signature) {
      return res.status(400).json({ error: "Missing webhook signature" });
    }

    // Validate webhook signature
    const event = validateEvent(rawBody, signature, POLAR_WEBHOOK_SECRET);

    if (!event) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    // Check for idempotency - have we already processed this event?
    const { data: existingEvent } = await supabaseServer
      .from("webhook_events")
      .select("id, processed")
      .eq("event_id", event.id)
      .single();

    if (existingEvent?.processed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return res.status(200).json({ success: true, skipped: true });
    }

    // Store webhook event
    await supabaseServer.from("webhook_events").upsert({
      event_id: event.id,
      event_type: event.type,
      payload: event.data as never,
      processed: false,
    });

    // Process the event based on type
    await processWebhookEvent(event);

    // Mark event as processed
    await supabaseServer
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", event.id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);

    // Log error to webhook_events table if we have an event ID
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      error: "Webhook processing failed",
      message: errorMessage,
    });
  }
}

/**
 * Process different types of webhook events
 */
async function processWebhookEvent(event: {
  type: string;
  data: Record<string, never>;
  id: string;
}) {
  console.log(`Processing webhook event: ${event.type}`);

  switch (event.type) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.active":
      await handleSubscriptionEvent(event);
      break;

    case "subscription.canceled":
      await handleSubscriptionCanceled(event);
      break;

    case "order.created":
      await handleOrderCreated(event);
      break;

    case "order.paid":
      await handleOrderPaid(event);
      break;

    case "order.refunded":
      await handleOrderRefunded(event);
      break;

    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }
}

/**
 * Handle subscription created/updated/active events
 */
async function handleSubscriptionEvent(event: {
  type: string;
  data: Record<string, never>;
}) {
  const subscription = event.data as {
    id: string;
    customer_id: string;
    product: { name: string };
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  };

  // Map product name to plan tier
  const planTier = mapProductToPlanTier(subscription.product.name);
  const status = mapSubscriptionStatus(subscription.status);

  // Find user by polar_customer_id
  const { data: existingSubscription } = await supabaseServer
    .from("subscriptions")
    .select("id, user_id")
    .eq("polar_customer_id", subscription.customer_id)
    .single();

  if (existingSubscription) {
    // Update existing subscription
    await supabaseServer
      .from("subscriptions")
      .update({
        polar_subscription_id: subscription.id,
        plan_tier: planTier,
        status: status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      })
      .eq("id", existingSubscription.id);

    console.log(
      `Updated subscription ${existingSubscription.id} for user ${existingSubscription.user_id}`
    );
  } else {
    console.warn(
      `No subscription found for polar_customer_id: ${subscription.customer_id}`
    );
  }
}

/**
 * Handle subscription canceled event
 */
async function handleSubscriptionCanceled(event: {
  type: string;
  data: Record<string, never>;
}) {
  const subscription = event.data as {
    id: string;
  };

  await supabaseServer
    .from("subscriptions")
    .update({
      status: "canceled",
    })
    .eq("polar_subscription_id", subscription.id);

  console.log(`Subscription ${subscription.id} canceled`);
}

/**
 * Handle order created event
 */
async function handleOrderCreated(event: {
  type: string;
  data: Record<string, never>;
}) {
  const order = event.data as {
    id: string;
    customer_id: string;
    amount: number;
    currency: string;
    subscription_id?: string;
  };

  // Find user by polar_customer_id
  const { data: userSubscription } = await supabaseServer
    .from("subscriptions")
    .select("user_id, id")
    .eq("polar_customer_id", order.customer_id)
    .single();

  if (!userSubscription) {
    console.warn(`No user found for polar_customer_id: ${order.customer_id}`);
    return;
  }

  // Create order record
  await supabaseServer.from("orders").insert({
    user_id: userSubscription.user_id,
    polar_order_id: order.id,
    polar_customer_id: order.customer_id,
    amount: order.amount,
    currency: order.currency,
    status: "pending",
    subscription_id: order.subscription_id
      ? userSubscription.id
      : (null as never),
  });

  console.log(`Order ${order.id} created for user ${userSubscription.user_id}`);
}

/**
 * Handle order paid event
 */
async function handleOrderPaid(event: {
  type: string;
  data: Record<string, never>;
}) {
  const order = event.data as {
    id: string;
  };

  await supabaseServer
    .from("orders")
    .update({
      status: "paid",
    })
    .eq("polar_order_id", order.id);

  console.log(`Order ${order.id} marked as paid`);
}

/**
 * Handle order refunded event
 */
async function handleOrderRefunded(event: {
  type: string;
  data: Record<string, never>;
}) {
  const order = event.data as {
    id: string;
  };

  await supabaseServer
    .from("orders")
    .update({
      status: "refunded",
    })
    .eq("polar_order_id", order.id);

  console.log(`Order ${order.id} marked as refunded`);
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

// Disable body parser so we can get the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
