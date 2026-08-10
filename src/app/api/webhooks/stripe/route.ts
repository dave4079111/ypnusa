import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await request.body?.cancel();
  return jsonError(
    "Stripe billing webhooks are accepted only by the ypnus.com entitlement service.",
    410,
    "STRIPE_WEBHOOK_WRONG_HOST",
    {
      headers: {
        "Cache-Control": "no-store",
        Link: '<https://ypnus.com/wp-json/ypnus/v1/stripe-webhook>; rel="alternate"',
      },
    },
  );
}
