import Stripe from "stripe";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import {
  claimStripeEvent,
  completeStripeEvent,
  releaseStripeEvent,
  updateStripeAccountLifecycle,
  upsertStripeCheckoutAccount,
} from "@/lib/stripe-store";
import type {
  AppAccountRecord,
  StripeSubscriptionStatus,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe("sk_test_webhook_signature_verification_only", {
  telemetry: false,
});
const ALLOWED_TIERS = ["starter", "pro", "elite"] as const;

type PaidTier = (typeof ALLOWED_TIERS)[number];

type PreparedEvent =
  | {
      kind: "checkout";
      email: string;
      name?: string;
      customerId: string;
      subscriptionId: string;
      tier: PaidTier;
    }
  | {
      kind: "lifecycle";
      customerId: string;
      subscriptionId: string;
      status: StripeSubscriptionStatus;
      tier?: PaidTier;
    }
  | { kind: "ignored" };

class StripeEventValidationError extends Error {}

function expandableId(value: { id?: string } | string | null | undefined): string {
  if (typeof value === "string") return value.trim();
  return value?.id?.trim() ?? "";
}

function paidTier(value: unknown): PaidTier | undefined {
  return ALLOWED_TIERS.find((tier) => tier === value);
}

function lifecycleStatus(status: Stripe.Subscription.Status): StripeSubscriptionStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "past_due";
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const runtimeInvoice = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id?: string } | null;
      } | null;
    } | null;
  };
  return expandableId(
    runtimeInvoice.parent?.subscription_details?.subscription ??
      runtimeInvoice.subscription,
  );
}

function prepareEvent(event: Stripe.Event): PreparedEvent {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const tier = paidTier(session.metadata?.ypnus_tier);
    if (!tier) {
      throw new StripeEventValidationError("Checkout tier is missing or not allowed.");
    }
    if (session.payment_status !== "paid") {
      throw new StripeEventValidationError("Checkout payment has not been verified as paid.");
    }
    if (session.mode !== "subscription") {
      throw new StripeEventValidationError("Checkout session is not a subscription.");
    }

    const email =
      session.customer_details?.email?.trim().toLowerCase() ??
      session.customer_email?.trim().toLowerCase() ??
      "";
    const customerId = expandableId(session.customer);
    const subscriptionId = expandableId(session.subscription);
    if (!email || !customerId || !subscriptionId) {
      throw new StripeEventValidationError(
        "Checkout email, customer, and subscription are required.",
      );
    }
    return {
      kind: "checkout",
      email,
      name: session.customer_details?.name?.trim() || undefined,
      customerId,
      subscriptionId,
      tier,
    };
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    const customerId = expandableId(subscription.customer);
    const subscriptionId = subscription.id.trim();
    if (!customerId || !subscriptionId) {
      throw new StripeEventValidationError(
        "Subscription customer and subscription IDs are required.",
      );
    }
    const metadataTier = subscription.metadata.ypnus_tier;
    const tier = metadataTier ? paidTier(metadataTier) : undefined;
    if (metadataTier && !tier) {
      throw new StripeEventValidationError("Subscription tier is not allowed.");
    }
    return {
      kind: "lifecycle",
      customerId,
      subscriptionId,
      status:
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : lifecycleStatus(subscription.status),
      tier,
    };
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = expandableId(invoice.customer);
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!customerId || !subscriptionId) {
      return { kind: "ignored" };
    }
    return {
      kind: "lifecycle",
      customerId,
      subscriptionId,
      status: "past_due",
    };
  }

  return { kind: "ignored" };
}

function processPreparedEvent(prepared: PreparedEvent): void {
  if (prepared.kind === "checkout") {
    upsertStripeCheckoutAccount({
      email: prepared.email,
      name: prepared.name,
      stripeCustomerId: prepared.customerId,
      stripeSubscriptionId: prepared.subscriptionId,
      tier: prepared.tier,
    });
    return;
  }
  if (prepared.kind === "lifecycle") {
    updateStripeAccountLifecycle({
      stripeCustomerId: prepared.customerId,
      stripeSubscriptionId: prepared.subscriptionId,
      subscriptionStatus: prepared.status,
      tier: prepared.tier as AppAccountRecord["tier"] | undefined,
    });
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return jsonError(
      "Stripe webhook verification is not configured.",
      503,
      "STRIPE_WEBHOOK_NOT_CONFIGURED",
    );
  }

  const signature = request.headers.get("stripe-signature")?.trim();
  if (!signature) {
    return jsonError("Missing Stripe signature header.", 400, "MISSING_STRIPE_SIGNATURE");
  }

  let event: Stripe.Event;
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    if (rawBody.length === 0) {
      return jsonError("Webhook body is required.", 400, "EMPTY_WEBHOOK_BODY");
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Stripe signature verification failed.",
      400,
      "INVALID_STRIPE_SIGNATURE",
    );
  }

  let prepared: PreparedEvent;
  try {
    prepared = prepareEvent(event);
  } catch (error) {
    if (error instanceof StripeEventValidationError) {
      return jsonError(error.message, 400, "INVALID_STRIPE_EVENT");
    }
    throw error;
  }

  const claim = claimStripeEvent(event.id, event.type);
  if (claim === "duplicate") {
    return jsonOk({ received: true, duplicate: true });
  }

  try {
    processPreparedEvent(prepared);
    completeStripeEvent(event.id);
    return jsonOk({
      received: true,
      duplicate: false,
      action: prepared.kind,
    });
  } catch (error) {
    releaseStripeEvent(event.id);
    logApiError("/api/webhooks/stripe", error);
    return jsonError(
      "Stripe event processing failed; delivery can be retried.",
      500,
      "STRIPE_WEBHOOK_FAILED",
    );
  }
}
