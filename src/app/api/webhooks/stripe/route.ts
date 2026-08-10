import { setRevenueSubscriptionStatusByStripeId, upsertRevenueSubscriptionByStripeId } from "@/lib/db";
import { generateId } from "@/lib/id";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { getPricingTier, PRICING_TIERS, type PricingTierId } from "@/lib/pricing";
import { checkTerritory } from "@/lib/territory";
import { parseStripeEvent, stripeWebhookConfigured, verifyStripeSignature } from "@/lib/stripe";
import type { RevenueSubscriptionRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function coerceTier(value: unknown): PricingTierId | null {
  return typeof value === "string" && PRICING_TIERS.some((tier) => tier.id === value)
    ? (value as PricingTierId)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Stripe payment success is the ZIP-allocation event: a tier's territory only becomes a
 * durable claimed RevenueSubscriptionRecord once checkout.session.completed fires here.
 * If the ZIP was claimed by someone else between checkout start and completion, the
 * subscription still activates (the MLO paid) but without that ZIP — logged for manual
 * follow-up rather than silently double-claiming a territory or auto-refunding.
 */
function handleCheckoutCompleted(object: Record<string, unknown>): void {
  const tier = coerceTier((object.metadata as Record<string, unknown> | undefined)?.tier);
  if (!tier || tier === "free") return;

  const zip = str((object.metadata as Record<string, unknown> | undefined)?.zip);
  const loId = str((object.metadata as Record<string, unknown> | undefined)?.loId);
  const email = str(object.customer_email) ?? str(object.customer_details && (object.customer_details as Record<string, unknown>).email);
  const stripeCustomerId = str(object.customer);
  const stripeSubscriptionId = str(object.subscription);

  if (!stripeSubscriptionId) {
    console.warn("[stripe webhook] checkout.session.completed missing a subscription id — skipping");
    return;
  }

  let claimedZips: string[] = [];
  if (zip) {
    const territory = checkTerritory(zip);
    if (territory.valid && territory.available) {
      claimedZips = [territory.zip];
    } else {
      console.warn(
        `[stripe webhook] subscription ${stripeSubscriptionId} paid for zip ${zip}, but it's no longer available — activating without a claimed zip; needs manual follow-up.`,
      );
    }
  }

  const now = new Date().toISOString();
  const record: RevenueSubscriptionRecord = {
    id: generateId("sub_stripe"),
    createdAt: now,
    startedAt: now,
    tier,
    status: "active",
    source: "stripe",
    ownerLoId: loId,
    ownerEmail: email,
    claimedZips,
    monthlyPriceCents: getPricingTier(tier).priceMonthlyCents,
    stripeCustomerId,
    stripeSubscriptionId,
  };
  upsertRevenueSubscriptionByStripeId(record);
}

function handleSubscriptionUpdated(object: Record<string, unknown>): void {
  const stripeSubscriptionId = str(object.id);
  const stripeStatus = str(object.status);
  if (!stripeSubscriptionId || !stripeStatus) return;

  const status: RevenueSubscriptionRecord["status"] =
    stripeStatus === "active" || stripeStatus === "trialing"
      ? (stripeStatus as "active" | "trialing")
      : "cancelled";
  setRevenueSubscriptionStatusByStripeId(stripeSubscriptionId, status);
}

function handleSubscriptionDeleted(object: Record<string, unknown>): void {
  const stripeSubscriptionId = str(object.id);
  if (!stripeSubscriptionId) return;
  setRevenueSubscriptionStatusByStripeId(stripeSubscriptionId, "cancelled");
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!stripeWebhookConfigured() || !webhookSecret) {
      return jsonError(
        "Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET unset).",
        501,
        "STRIPE_WEBHOOK_NOT_CONFIGURED",
      );
    }

    const signature = request.headers.get("stripe-signature");
    const rawBody = await request.text();
    if (!rawBody) {
      return jsonError("Webhook body is required.", 400, "EMPTY_WEBHOOK_BODY");
    }

    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return jsonError("Invalid Stripe signature.", 400, "INVALID_STRIPE_SIGNATURE");
    }

    const event = parseStripeEvent(rawBody);
    if (!event) {
      return jsonError("Malformed Stripe event payload.", 400, "INVALID_STRIPE_EVENT");
    }

    switch (event.type) {
      case "checkout.session.completed":
        handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        handleSubscriptionDeleted(event.data.object);
        break;
      default:
        // Unhandled event types are acknowledged, not errors — Stripe expects a 2xx.
        break;
    }

    return jsonOk({ received: true });
  } catch (error) {
    logApiError("/api/webhooks/stripe", error);
    return jsonError("Stripe webhook could not be processed.", 500, "STRIPE_WEBHOOK_FAILED");
  }
}
