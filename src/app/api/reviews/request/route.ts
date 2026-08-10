import { getPublicBusinessProfile } from "@/lib/local-seo";
import { requireBearerSecret } from "@/lib/http";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";
import {
  buildReviewRequestMessage,
  parseReviewRequestInput,
} from "@/lib/review-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireBearerSecret(request, "REVIEW_REQUEST_API_SECRET");
  if (unauthorized) return unauthorized;
  const limited = await distributedRateLimit(
    `review-request:${clientKey(request)}`,
    30,
    60_000,
  );
  if (!limited.ok) {
    return Response.json(
      { error: "Too many review request events." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let payload: unknown;
  try {
    payload = (await request.json()) as unknown;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = parseReviewRequestInput(payload);
  if (!input) {
    return Response.json(
      { error: "A closingId of 1–100 characters is required." },
      { status: 400 },
    );
  }

  const message = buildReviewRequestMessage(input, getPublicBusinessProfile());
  if (!message) {
    return Response.json(
      {
        error:
          "Google review automation is not configured. Add the verified GBP_PLACE_ID first.",
      },
      { status: 503 },
    );
  }

  const webhookUrl = process.env.REVIEW_REQUEST_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        {
          accepted: false,
          delivered: false,
          reason: "Review delivery is not configured.",
          closingId: message.closingId,
        },
        { status: 503 },
      );
    }
    return Response.json({
      accepted: true,
      delivered: false,
      reason: "REVIEW_REQUEST_WEBHOOK_URL is not configured.",
      reviewUrl: message.reviewUrl,
      closingId: message.closingId,
    });
  }
  if (process.env.NODE_ENV === "production") {
    try {
      if (new URL(webhookUrl).protocol !== "https:") throw new Error("insecure");
    } catch {
      return Response.json(
        { accepted: false, delivered: false, reason: "Review delivery URL is invalid." },
        { status: 503 },
      );
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.REVIEW_REQUEST_WEBHOOK_TOKEN?.trim()
          ? { authorization: `Bearer ${process.env.REVIEW_REQUEST_WEBHOOK_TOKEN.trim()}` }
          : {}),
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return Response.json(
        {
          accepted: true,
          delivered: false,
          reason: `Configured delivery provider returned HTTP ${response.status}.`,
          closingId: message.closingId,
        },
        { status: 502 },
      );
    }
  } catch {
    return Response.json(
      {
        accepted: true,
        delivered: false,
        reason: "Configured delivery provider could not be reached.",
        closingId: message.closingId,
      },
      { status: 502 },
    );
  }

  return Response.json(
    {
      accepted: true,
      delivered: true,
      closingId: message.closingId,
    },
    { status: 202 },
  );
}
