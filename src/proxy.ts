import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { appSessionCookieName, verifyAppSessionToken } from "@/lib/auth";
import { marketingUrl } from "@/lib/site";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(appSessionCookieName())?.value;
  try {
    if (!token) throw new Error("Session cookie is missing.");
    verifyAppSessionToken(token);
    return NextResponse.next();
  } catch {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(
      marketingUrl("/wp-admin/admin-post.php?action=ypnus_app_sso"),
    );
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portal/:path*",
    "/analytics/:path*",
    "/admin/:path*",
    "/api/analytics/:path*",
    "/api/revenue/:path*",
  ],
};
