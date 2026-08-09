import { jsonError, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature")?.trim();
    if (!signature) {
      return jsonError("Missing Stripe signature header.", 400, "MISSING_STRIPE_SIGNATURE");
    }

    const rawBody = await request.text();
    if (!rawBody) {
      return jsonError("Webhook body is required.", 400, "EMPTY_WEBHOOK_BODY");
    }

    return jsonError(
      "Stripe webhook verification is not configured in this stub route.",
      501,
      "STRIPE_WEBHOOK_STUB",
    );
  } catch (error) {
    logApiError("/api/webhooks/stripe", error);
    return jsonError("Stripe webhook could not be processed.", 500, "STRIPE_WEBHOOK_FAILED");
  }
}
