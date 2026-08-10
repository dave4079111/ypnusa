import { AUTH_COOKIE_NAME, revokeSession, sessionIdFromRequest } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { marketingUrl } from "@/lib/site";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOriginIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const appOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://app.ypnus.com";
  if (!origin) {
    return (
      process.env.NODE_ENV !== "production" &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  }
  return origin === appOrigin;
}

export function POST(request: Request) {
  if (!requestOriginIsAllowed(request)) {
    return jsonError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
  }

  revokeSession(sessionIdFromRequest(request));
  const response = request.headers.get("accept")?.includes("text/html")
    ? NextResponse.redirect(marketingUrl("/"), 303)
    : jsonOk(
        { loggedOut: true },
        { headers: { "Cache-Control": "no-store" } },
      );
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
