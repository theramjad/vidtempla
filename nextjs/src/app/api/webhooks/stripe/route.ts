import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe-server";
import { db } from "@/db";
import { webhookEvents, subscriptions, member, userCredits } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { PlanTier, SubscriptionStatus } from "@/lib/stripe";
import { mapPriceIdToPlanTier, PLAN_CONFIG } from "@/lib/stripe";
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

type WebhookDatabase = Pick<typeof db, "insert" | "select" | "update">;

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
    return await db.transaction(async (tx) => {
      const lockRows = await tx.execute(sql<{ locked: boolean }>`
        select pg_try_advisory_xact_lock(hashtextextended(${event.id}, 0)) as locked
      `);

      if (!lockRows[0]?.locked) {
        console.log(`Webhook event already in progress: ${event.id}`);
        return NextResponse.json(
          { error: "Webhook event already in progress" },
          { status: 500 }
        );
      }

      // Idempotency guard: processed Stripe events must be acknowledged without
      // replaying side effects when Stripe retries or manually replays an event.
      const [existing] = await tx
        .select({ processed: webhookEvents.processed })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, event.id))
        .limit(1);

      if (existing?.processed) {
        console.log(`Skipping already-processed webhook event: ${event.id}`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Store webhook event for audit trail and idempotency. Preserve an existing
      // row so duplicates cannot reset `processed` back to false.
      await tx.insert(webhookEvents).values({
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
          await handleCheckoutCompleted(tx, event.data.object as Stripe.Checkout.Session);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpdate(tx, event.data.object as StripeSubscriptionWithPeriods);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(tx, event.data.object as Stripe.Subscription);
          break;

        case "invoice.paid":
          console.log(`Invoice paid: ${(event.data.object as StripeInvoiceWithSubscription).id}`);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(tx, event.data.object as StripeInvoiceWithSubscription);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      await tx.update(webhookEvents)
        .set({ processed: true, processedAt: new Date(), errorMessage: null })
        .where(eq(webhookEvents.eventId, event.id));

      return NextResponse.json({ received: true });
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    await recordWebhookProcessingError(event, error);

    // Return 500 so Stripe retries with exponential backoff. The webhook_events
    // idempotency guard prevents double-processing on retry.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(database: WebhookDatabase, session: Stripe.Checkout.Session) {
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
  await database.update(subscriptions)
    .set({
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
    })
    .where(whereClause);

  console.log(`Updated subscription for org ${organizationId ?? userId} with customer ${customerId}`);

  // Fetch and process the subscription details
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(database, subscription as unknown as StripeSubscriptionWithPeriods);
  }
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionUpdate(database: WebhookDatabase, subscription: StripeSubscriptionWithPeriods) {
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
  const [existingSubscription] = await database.select({
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
  await database.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, existingSubscription.id));

  // Upsert credit allocation for the new plan
  const allocation = PLAN_CONFIG[planTier].monthlyCredits;
  const periodStart = updateData.currentPeriodStart ?? new Date();
  const periodEnd = updateData.currentPeriodEnd ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  await upsertCreditsForWebhook(database, existingSubscription.organizationId ?? existingSubscription.userId, allocation, periodStart, periodEnd);

  console.log(`Updated subscription ${existingSubscription.id} to ${planTier} (${status})`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(database: WebhookDatabase, subscription: Stripe.Subscription) {
  console.log(`Processing subscription.deleted: ${subscription.id}`);

  const [sub] = await database.select({ userId: subscriptions.userId, organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  await database.update(subscriptions)
    .set({
      status: "canceled",
      planTier: "free", // Revert to free plan
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  // Reset credits to free tier allocation
  if (sub) {
    const freeAllocation = PLAN_CONFIG.free.monthlyCredits;
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await upsertCreditsForWebhook(database, sub.organizationId ?? sub.userId, freeAllocation, now, periodEnd);
  }

  console.log(`Subscription ${subscription.id} deleted and reverted to free`);
}


/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(database: WebhookDatabase, invoice: StripeInvoiceWithSubscription) {
  console.log(`Processing invoice.payment_failed: ${invoice.id}`);

  const subscriptionId = invoice.subscription as string;

  if (subscriptionId) {
    // Update subscription status to past_due
    await database.update(subscriptions)
      .set({ status: "past_due" })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

    console.log(`Subscription ${subscriptionId} marked as past_due`);
  }
}

async function upsertCreditsForWebhook(
  database: WebhookDatabase,
  organizationId: string,
  allocation: number,
  periodStart: Date,
  periodEnd: Date,
  userId?: string
) {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const [owner] = await database
      .select({ userId: member.userId })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
      .limit(1);
    resolvedUserId = owner?.userId ?? undefined;

    if (!resolvedUserId) {
      const [anyMember] = await database
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, organizationId))
        .limit(1);
      resolvedUserId = anyMember?.userId;
    }

    if (!resolvedUserId) {
      console.error(`upsertCreditsForWebhook: no members found for org ${organizationId}`);
      return;
    }
  }

  await database.insert(userCredits).values({
    organizationId,
    userId: resolvedUserId,
    balance: allocation,
    monthlyAllocation: allocation,
    periodStart,
    periodEnd,
  }).onConflictDoUpdate({
    target: userCredits.organizationId,
    set: {
      balance: allocation,
      monthlyAllocation: allocation,
      periodStart,
      periodEnd,
      updatedAt: new Date(),
    },
  });
}

async function recordWebhookProcessingError(event: Stripe.Event, error: unknown) {
  try {
    await db.insert(webhookEvents).values({
      eventId: event.id,
      eventType: event.type,
      payload: event.data.object as never,
      processed: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).onConflictDoUpdate({
      target: webhookEvents.eventId,
      set: {
        eventType: event.type,
        payload: event.data.object as never,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
  } catch (logError) {
    console.error("Failed to record webhook processing error:", logError);
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
