import { createHmac, timingSafeEqual } from "crypto";
import { APP_SITE_URL } from "@/lib/site";
import type { PricingTierId } from "@/lib/pricing";

/**
 * Minimal Stripe integration over `fetch` + the REST API — no `stripe` SDK dependency,
 * consistent with this repo's near-zero-dependency footprint. Covers exactly what's
 * needed: creating a Checkout Session for a paid tier, and verifying webhook signatures.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 300;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

const TIER_PRICE_ENV: Record<Exclude<PricingTierId, "free">, string> = {
  starter: "STRIPE_PRICE_ID_STARTER",
  pro: "STRIPE_PRICE_ID_PRO",
  elite: "STRIPE_PRICE_ID_ELITE",
};

export function resolvePriceId(tier: PricingTierId): string | null {
  if (tier === "free") return null;
  return process.env[TIER_PRICE_ENV[tier]]?.trim() || null;
}

export interface CreateCheckoutSessionParams {
  tier: Exclude<PricingTierId, "free">;
  email: string;
  loId?: string;
  zip?: string;
}

export type CreateCheckoutSessionResult = { ok: true; url: string } | { ok: false; error: string };

/** Creates a Stripe Checkout Session for a paid tier. Fails closed if unconfigured. */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<CreateCheckoutSessionResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return { ok: false, error: "Stripe is not configured (STRIPE_SECRET_KEY unset)." };
  }

  const priceId = resolvePriceId(params.tier);
  if (!priceId) {
    return { ok: false, error: `No Stripe price configured for tier "${params.tier}".` };
  }

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: params.email,
    success_url: `${APP_SITE_URL}/dashboard?checkout=success`,
    cancel_url: `${APP_SITE_URL}/dashboard?checkout=cancelled`,
    "metadata[tier]": params.tier,
  });
  if (params.loId) body.set("metadata[loId]", params.loId);
  if (params.zip) body.set("metadata[zip]", params.zip);

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.url) {
    return { ok: false, error: payload?.error?.message ?? "Stripe checkout session could not be created." };
  }

  return { ok: true, url: payload.url };
}

/**
 * Verifies a Stripe webhook signature per Stripe's documented scheme:
 * header is `t=<unix seconds>,v1=<hex hmac>[,v1=<hex hmac>...]`, and the signed
 * payload is `${t}.${rawBody}`. Multiple v1 values can appear during secret rotation —
 * any match is accepted. Rejects stale timestamps to bound replay risk.
 */
export function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<{ t?: string; v1: string[] }>(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.t = value;
      else if (key === "v1" && value) acc.v1.push(value);
      return acc;
    },
    { v1: [] },
  );

  if (!parts.t || parts.v1.length === 0) return false;

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected);

  return parts.v1.some((candidate) => {
    const candidateBuf = Buffer.from(candidate);
    return candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf);
  });
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export function parseStripeEvent(rawBody: string): StripeEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as StripeEvent;
    if (typeof parsed.type !== "string" || !parsed.data?.object) return null;
    return parsed;
  } catch {
    return null;
  }
}
