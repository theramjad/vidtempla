import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe-server";
import { supabaseServer } from "@/lib/clients/supabase";
import type { PlanTier, SubscriptionStatus } from "@/lib/stripe";
import { mapPriceIdToPlanTier } from "@/lib/stripe";
import Stripe from "stripe";

/**
 * Extended Stripe types with properties that exist in the API but may not be in type definitions
 */
interface StripeSubscriptionWithPeriods extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

interface StripeInvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | Stripe.Subscription | null;
}

/**
 * Stripe webhook handler
 * Handles subscription lifecycle events from Stripe
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    console.error("Missing stripe-signature header or webhook secret");
    return NextResponse.json(
      { error: "Webhook signature missing" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 400 }
    );
  }

  console.log(`Received webhook event: ${event.type}`);

  try {
    // Store webhook event for audit trail and idempotency
    await supabaseServer.from("webhook_events").upsert({
      event_id: event.id,
      event_type: event.type,
      payload: event.data.object as never,
      processed: false,
    });

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as StripeSubscriptionWithPeriods);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        console.log(`Invoice paid: ${(event.data.object as StripeInvoiceWithSubscription).id}`);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as StripeInvoiceWithSubscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabaseServer
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("event_id", event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);

    // Log error in webhook_events table
    await supabaseServer
      .from("webhook_events")
      .update({
        processed: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("event_id", event.id);

    // Return 200 to prevent Stripe from retrying
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`Processing checkout.session.completed: ${session.id}`);

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.userId;

  if (!userId) {
    console.warn(`No userId in checkout session metadata: ${session.id}`);
    return;
  }

  // Update subscription record with Stripe customer ID and checkout session
  await supabaseServer
    .from("subscriptions")
    .update({
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
    })
    .eq("user_id", userId);

  console.log(`Updated subscription for user ${userId} with customer ${customerId}`);

  // Fetch and process the subscription details
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(subscription as unknown as StripeSubscriptionWithPeriods);
  }
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionUpdate(subscription: StripeSubscriptionWithPeriods) {
  console.log(`Processing subscription update: ${subscription.id}`);

  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) {
    console.warn(`No price ID found for subscription: ${subscription.id}`);
    return;
  }

  // Map price ID to plan tier
  const planTier = mapPriceIdToPlanTier(priceId);
  const status = mapSubscriptionStatus(subscription.status);

  // Find subscription by stripe_customer_id
  const { data: existingSubscription } = await supabaseServer
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!existingSubscription) {
    console.warn(`No subscription found for customer: ${customerId}`);
    return;
  }

  // Build update object with required fields
  const updateData: {
    stripe_subscription_id: string;
    plan_tier: PlanTier;
    status: SubscriptionStatus;
    cancel_at_period_end: boolean;
    current_period_start?: string;
    current_period_end?: string;
  } = {
    stripe_subscription_id: subscription.id,
    plan_tier: planTier,
    status: status,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  // Only add period dates if they exist and are valid
  if (subscription.current_period_start && typeof subscription.current_period_start === 'number') {
    updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
  }
  if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
    updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }

  // Update subscription
  await supabaseServer
    .from("subscriptions")
    .update(updateData)
    .eq("id", existingSubscription.id);

  console.log(`Updated subscription ${existingSubscription.id} to ${planTier} (${status})`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`Processing subscription.deleted: ${subscription.id}`);

  await supabaseServer
    .from("subscriptions")
    .update({
      status: "canceled",
      plan_tier: "free", // Revert to free plan
    })
    .eq("stripe_subscription_id", subscription.id);

  console.log(`Subscription ${subscription.id} deleted and reverted to free`);
}


/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: StripeInvoiceWithSubscription) {
  console.log(`Processing invoice.payment_failed: ${invoice.id}`);

  const subscriptionId = invoice.subscription as string;

  if (subscriptionId) {
    // Update subscription status to past_due
    await supabaseServer
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("stripe_subscription_id", subscriptionId);

    console.log(`Subscription ${subscriptionId} marked as past_due`);
  }
}

/**
 * Map Stripe subscription status to our status enum
 */
function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
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
    case "incomplete_expired":
      return "incomplete_expired";
    default:
      return "active";
  }
}
