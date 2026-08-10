import { getSession } from "@/lib/auth";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { createCheckoutSession } from "@/lib/stripe";
import { isValidZip, normalizeZip } from "@/lib/territory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID_TIERS = new Set(["starter", "pro", "elite"]);

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return jsonError("Sign in required to start checkout.", 401, "UNAUTHENTICATED");
    }

    const limited = rateLimit(`checkout:${clientKey(request)}`, 5, 60_000);
    if (!limited.ok) {
      return jsonError("Too many requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
        headers: { "Retry-After": String(limited.retryAfter) },
      });
    }

    const parsed = await parseJsonBody(request);
    if (!parsed.ok || !isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const tier = typeof parsed.data.tier === "string" ? parsed.data.tier : "";
    if (!PAID_TIERS.has(tier)) {
      return jsonError("tier must be one of starter, pro, elite.", 400, "INVALID_TIER");
    }

    const zip = normalizeZip(parsed.data.zip);
    if (zip && !isValidZip(zip)) {
      return jsonError("zip must be a valid 5-digit ZIP code.", 400, "INVALID_ZIP");
    }

    const result = await createCheckoutSession({
      tier: tier as "starter" | "pro" | "elite",
      email: session.email,
      zip: zip || undefined,
    });

    if (!result.ok) {
      return jsonError(result.error, 502, "STRIPE_CHECKOUT_FAILED");
    }

    return jsonOk({ url: result.url });
  } catch (error) {
    logApiError("/api/billing/checkout", error);
    return jsonError("Checkout could not be started.", 500, "CHECKOUT_FAILED");
  }
}
