import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  APP_SESSION_MAX_AGE_SECONDS,
  appSessionCookieName,
  createAppSessionToken,
  verifyWordpressHandoffToken,
} from "@/lib/auth";
import { consumeSsoExchange } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorRedirect(request: NextRequest, code: string): NextResponse {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("code", code);
  return NextResponse.redirect(url);
}

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return errorRedirect(request, "missing_token");

  try {
    const handoff = verifyWordpressHandoffToken(token);
    const consumed = consumeSsoExchange(
      handoff.jti,
      new Date(handoff.exp * 1000).toISOString(),
    );
    if (!consumed) return errorRedirect(request, "token_already_used");

    const sessionToken = createAppSessionToken(handoff);
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set(appSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: APP_SESSION_MAX_AGE_SECONDS,
      priority: "high",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return errorRedirect(request, "invalid_token");
  }
}
