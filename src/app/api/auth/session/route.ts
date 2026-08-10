import { sessionIdFromRequest, verifySession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await distributedRateLimit(
    `auth-session:${clientKey(request)}`,
    120,
    60_000,
  );
  if (!limited.ok) {
    return jsonError("Too many session checks.", 429, "RATE_LIMITED", {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(limited.retryAfter),
      },
    });
  }
  const session = verifySession(sessionIdFromRequest(request));
  if (!session) {
    return jsonError("Authentication required.", 401, "UNAUTHENTICATED", {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return jsonOk(
    {
      profile: session.profile,
      expiresAt: session.expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
