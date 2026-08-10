import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { jsonError, logApiError } from "@/lib/http";
import { verifySsoHandoff } from "@/lib/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSO callback: ypnus.com redirects here after verifying a user's identity. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = verifySsoHandoff(url);
    if ("error" in result) {
      return jsonError(result.error, 401, "SSO_HANDOFF_INVALID");
    }

    await createSession({ sub: result.sub, email: result.email, role: result.role });

    return NextResponse.redirect(new URL(result.next, url.origin));
  } catch (error) {
    logApiError("/api/auth/callback", error);
    return jsonError("SSO callback could not be processed.", 500, "SSO_CALLBACK_FAILED");
  }
}
