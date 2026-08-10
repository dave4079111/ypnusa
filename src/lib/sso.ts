import { createHmac, timingSafeEqual } from "crypto";
import type { SessionRole } from "@/lib/session";

/**
 * SSO handoff contract: how ypnus.com (WordPress) hands an authenticated user off to
 * app.ypnus.com after it verifies identity (login, signup, or MLO account creation).
 *
 * WordPress redirects the browser to:
 *
 *   GET https://app.ypnus.com/api/auth/callback
 *     ?email=<user email>
 *     &sub=<stable WP user id>
 *     &role=mlo|admin
 *     &iat=<unix seconds when the token was issued>
 *     &next=<optional relative path, defaults to /dashboard>
 *     &sig=<base64url HMAC-SHA256 of "email|sub|role|iat|next" using YPNUS_SSO_SHARED_SECRET>
 *
 * Both hosts must share the same YPNUS_SSO_SHARED_SECRET. The token is single-use in spirit
 * (short-lived, 5 minutes) but not replay-proof across that window — WordPress should treat it
 * as a one-time redirect, not a durable credential. See docs/sso-handoff.md.
 */

const HANDOFF_TTL_SECONDS = 300;

export interface SsoHandoffClaim {
  sub: string;
  email: string;
  role: SessionRole;
  next: string;
}

function ssoSecret(): string | null {
  return process.env.YPNUS_SSO_SHARED_SECRET?.trim() || null;
}

export function ssoHandoffConfigured(): boolean {
  return ssoSecret() !== null;
}

function canonicalMessage(email: string, sub: string, role: string, iat: string, next: string): string {
  return [email, sub, role, iat, next].join("|");
}

export function verifySsoHandoff(url: URL): SsoHandoffClaim | { error: string } {
  const secret = ssoSecret();
  if (!secret) {
    return { error: "SSO handoff is not configured on this deployment (YPNUS_SSO_SHARED_SECRET unset)." };
  }

  const email = url.searchParams.get("email")?.trim();
  const sub = url.searchParams.get("sub")?.trim();
  const role = url.searchParams.get("role")?.trim();
  const iat = url.searchParams.get("iat")?.trim();
  const next = url.searchParams.get("next")?.trim() || "/dashboard";
  const sig = url.searchParams.get("sig")?.trim();

  if (!email || !sub || !role || !iat || !sig) {
    return { error: "Missing required SSO handoff parameters." };
  }
  if (role !== "mlo" && role !== "admin") {
    return { error: "Unrecognized role in SSO handoff." };
  }
  if (!next.startsWith("/") || next.startsWith("//")) {
    return { error: "Invalid redirect target." };
  }

  const iatNum = Number(iat);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(iatNum) || Math.abs(nowSeconds - iatNum) > HANDOFF_TTL_SECONDS) {
    return { error: "SSO handoff token has expired." };
  }

  const expectedSig = createHmac("sha256", secret)
    .update(canonicalMessage(email, sub, role, iat, next))
    .digest("base64url");

  const provided = Buffer.from(sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { error: "SSO handoff signature is invalid." };
  }

  return { sub, email, role: role as SessionRole, next };
}
