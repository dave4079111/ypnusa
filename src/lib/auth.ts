import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { type ApiErrorEnvelope, jsonError, requireConfiguredSecret } from "@/lib/http";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
  type SessionRole,
} from "@/lib/session";

export async function createSession(user: { sub: string; email: string; role: SessionRole }): Promise<void> {
  const token = createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/** Cached per-request: reads and verifies the session cookie. Optimistic only — see proxy.ts. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
});

/**
 * For API routes that back a proxy-gated dashboard page (e.g. /admin/revenue,
 * /analytics): the page itself is only reachable with a valid session, but nothing
 * stops a caller from hitting the API route directly. requireConfiguredSecret alone
 * is insufficient here — it no-ops (allows all traffic) when ADMIN_TOKEN/CRON_SECRET
 * aren't configured, which they aren't by default. Require EITHER a valid session
 * or the configured secret, so the route is never open-by-default.
 */
export async function requireSessionOrSecret(request: Request): Promise<NextResponse<ApiErrorEnvelope> | null> {
  const session = await getSession();
  if (session) return null;

  // requireConfiguredSecret alone would return null (allow) here too when no secret is
  // configured — that's the right default for machine-only endpoints, but wrong for a
  // route standing in for a session-gated page: deny outright rather than default-open.
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!adminToken && !cronSecret) {
    return jsonError("Unauthorized.", 401, "UNAUTHORIZED");
  }
  return requireConfiguredSecret(request);
}
