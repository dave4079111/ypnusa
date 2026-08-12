import { getPublicBusinessProfile } from "@/lib/local-seo";
import { OUTBOUND_TIMEOUT_MS } from "@/lib/outbound";
import {
  buildReviewRequestMessage,
  parseReviewRequestInput,
} from "@/lib/review-automation";

function isAuthorized(request: Request): boolean {
  const secret = process.env.REVIEW_REQUEST_API_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized review request event." }, { status: 401 });
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
    return Response.json({
      accepted: true,
      delivered: false,
      reason: "REVIEW_REQUEST_WEBHOOK_URL is not configured.",
      reviewUrl: message.reviewUrl,
      closingId: message.closingId,
    });
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
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
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
