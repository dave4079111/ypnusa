import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function GET(request: Request) {
  const session = verifySession(cookieValue(request, AUTH_COOKIE_NAME));
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
