import { sessionSecretDiagnostics } from "@/lib/session";
import { ssoSecretDiagnostics } from "@/lib/sso";
import { jsonError, jsonOk, logApiError, requireSecret } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-gated diagnostic for verifying the SSO handoff is configured without ever
 * exposing SESSION_SECRET/YPNUS_SSO_SHARED_SECRET. Each fingerprint is the first 8
 * hex chars of sha256(secret) — enough to compare against an independently computed
 * fingerprint on the WordPress side (e.g. `wp config get YPNUS_SSO_SHARED_SECRET
 * --type=constant | sha256sum | cut -c1-8`), never enough to recover the secret.
 */
export async function GET(request: Request) {
  try {
    const unauthorized = requireSecret(request);
    if (unauthorized) return unauthorized;

    const limited = rateLimit(`health-sso:${clientKey(request)}`, 20, 60_000);
    if (!limited.ok) {
      return jsonError("Too many requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
        headers: { "Retry-After": String(limited.retryAfter) },
      });
    }

    return jsonOk({
      session: sessionSecretDiagnostics(),
      sso: ssoSecretDiagnostics(),
    });
  } catch (error) {
    logApiError("/api/health/sso", error);
    return jsonError("SSO diagnostics failed.", 500, "HEALTH_SSO_FAILED");
  }
}
