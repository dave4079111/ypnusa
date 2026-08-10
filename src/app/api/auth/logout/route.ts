import { AUTH_COOKIE_NAME, revokeSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function requestOriginIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  const appOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://app.ypnus.com";
  return origin === appOrigin;
}

export function POST(request: Request) {
  if (!requestOriginIsAllowed(request)) {
    return jsonError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
  }

  revokeSession(cookieValue(request, AUTH_COOKIE_NAME));
  const response = jsonOk(
    { loggedOut: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
