import { sessionIdFromRequest, verifySession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
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
