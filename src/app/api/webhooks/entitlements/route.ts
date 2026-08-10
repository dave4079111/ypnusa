import { createHmac, timingSafeEqual } from "node:crypto";
import { applyEntitlementSync, parseEntitlementSync } from "@/lib/entitlements";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signatureIsValid(rawBody: string, timestamp: string, supplied: string): boolean {
  const secret = process.env.ENTITLEMENT_SYNC_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32 || !/^\d{10}$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const candidate = supplied.replace(/^sha256=/, "").toLowerCase();
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
}

export async function POST(request: Request) {
  const secret = process.env.ENTITLEMENT_SYNC_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    return jsonError(
      "Entitlement synchronization is not configured.",
      503,
      "ENTITLEMENT_SYNC_NOT_CONFIGURED",
    );
  }
  const limited = await distributedRateLimit(
    `entitlement-webhook:${clientKey(request)}`,
    120,
    60_000,
  );
  if (!limited.ok) {
    return jsonError("Too many entitlement events.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody) > 262_144) {
      return jsonError("Entitlement payload is missing or too large.", 400, "INVALID_BODY");
    }
    const timestamp = request.headers.get("x-ypnus-timestamp")?.trim() ?? "";
    const signature = request.headers.get("x-ypnus-signature")?.trim() ?? "";
    if (!signatureIsValid(rawBody, timestamp, signature)) {
      return jsonError("Entitlement signature is invalid.", 401, "INVALID_SIGNATURE");
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(rawBody) as unknown;
    } catch {
      return jsonError("Entitlement payload must be valid JSON.", 400, "INVALID_JSON");
    }
    const input = parseEntitlementSync(decoded);
    if (!input) {
      return jsonError("Entitlement payload is invalid.", 400, "INVALID_ENTITLEMENT");
    }
    return jsonOk(applyEntitlementSync(input));
  } catch (error) {
    logApiError("/api/webhooks/entitlements", error);
    return jsonError("Entitlement synchronization failed.", 500, "ENTITLEMENT_SYNC_FAILED");
  }
}
