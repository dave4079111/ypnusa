import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Optimistic auth gate for dashboard-style routes (cookie-only check — see
 * src/lib/auth.ts / getSession() for the authoritative per-request check that route
 * handlers and pages must still perform; proxy alone is not a full auth boundary).
 */
const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/analytics", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/analytics/:path*", "/admin/:path*"],
};
