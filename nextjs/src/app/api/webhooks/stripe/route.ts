import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe-server";
import { db } from "@/db";
import { webhookEvents, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PlanTier, SubscriptionStatus } from "@/lib/stripe";
import { mapPriceIdToPlanTier, PLAN_CONFIG } from "@/lib/stripe";
import { upsertCredits } from "@/lib/plan-limits";
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
    // Idempotency guard: if this event has already been processed, acknowledge
    // without re-running handlers. Stripe redelivers (retries, manual replays,
    // network blips) must not cause duplicate credit allocations or notifications.
    const [existing] = await db
      .select({ processed: webhookEvents.processed })
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    if (existing?.processed) {
      console.log(`Skipping already-processed webhook event: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Store webhook event for audit trail and idempotency.
    // Use onConflictDoNothing so an in-flight retry that arrives mid-processing
    // does not reset `processed` back to false on the original row.
    await db.insert(webhookEvents).values({
      eventId: event.id,
      eventType: event.type,
      payload: event.data.object as never,
      processed: false,
    }).onConflictDoNothing({
      target: webhookEvents.eventId,
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
    await db.update(webhookEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(webhookEvents.eventId, event.id));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);

    // Log error in webhook_events table
    await db.update(webhookEvents)
      .set({
        processed: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(webhookEvents.eventId, event.id));

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
  const organizationId = session.metadata?.organizationId;

  if (!userId && !organizationId) {
    console.warn(`No userId or organizationId in checkout session metadata: ${session.id}`);
    return;
  }

  // Update subscription record with Stripe customer ID and checkout session
  const whereClause = organizationId
    ? eq(subscriptions.organizationId, organizationId)
    : eq(subscriptions.userId, userId!);
  await db.update(subscriptions)
    .set({
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
    })
    .where(whereClause);

  console.log(`Updated subscription for org ${organizationId ?? userId} with customer ${customerId}`);

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
  const [existingSubscription] = await db.select({
    id: subscriptions.id,
    userId: subscriptions.userId,
    organizationId: subscriptions.organizationId,
  }).from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId));

  if (!existingSubscription) {
    console.warn(`No subscription found for customer: ${customerId}`);
    return;
  }

  // Build update object with required fields
  const updateData: {
    stripeSubscriptionId: string;
    planTier: PlanTier;
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  } = {
    stripeSubscriptionId: subscription.id,
    planTier: planTier,
    status: status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  // Only add period dates if they exist and are valid
  if (subscription.current_period_start && typeof subscription.current_period_start === 'number') {
    updateData.currentPeriodStart = new Date(subscription.current_period_start * 1000);
  }
  if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
    updateData.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  // Update subscription
  await db.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, existingSubscription.id));

  // Upsert credit allocation for the new plan
  const allocation = PLAN_CONFIG[planTier].monthlyCredits;
  const periodStart = updateData.currentPeriodStart ?? new Date();
  const periodEnd = updateData.currentPeriodEnd ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  await upsertCredits(existingSubscription.organizationId ?? existingSubscription.userId, allocation, periodStart, periodEnd);

  console.log(`Updated subscription ${existingSubscription.id} to ${planTier} (${status})`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`Processing subscription.deleted: ${subscription.id}`);

  const [sub] = await db.select({ userId: subscriptions.userId, organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  await db.update(subscriptions)
    .set({
      status: "canceled",
      planTier: "free", // Revert to free plan
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  // Reset credits to free tier allocation
  if (sub) {
    const freeAllocation = PLAN_CONFIG.free.monthlyCredits;
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await upsertCredits(sub.organizationId ?? sub.userId, freeAllocation, now, periodEnd);
  }

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
    await db.update(subscriptions)
      .set({ status: "past_due" })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

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
