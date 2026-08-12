import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { type ApiErrorEnvelope, jsonError, requireSecret } from "@/lib/http";
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
 * Authoritative page-level gate. `proxy.ts` is an optimistic redirect only — a
 * proxy/middleware bypass would otherwise render borrower PII and revenue data to
 * an unauthenticated caller, so every protected page must call this itself.
 */
export async function requireSession(pathname: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  return session;
}

/** Page-level gate that additionally requires the `admin` role. */
export async function requireAdminSession(pathname: string): Promise<SessionPayload> {
  const session = await requireSession(pathname);
  if (session.role !== "admin") {
    redirect("/dashboard");
  }
  return session;
}

/** API equivalent of requireAdminSession: a valid admin session, or the configured secret. */
export async function requireAdminSessionOrSecret(
  request: Request,
): Promise<NextResponse<ApiErrorEnvelope> | null> {
  const session = await getSession();
  if (session) {
    return session.role === "admin" ? null : jsonError("Forbidden.", 403, "FORBIDDEN");
  }
  return requireSecret(request);
}

/**
 * For API routes that back a proxy-gated dashboard page (e.g. /admin/revenue,
 * /analytics): the page itself is only reachable with a valid session, but nothing
 * stops a caller from hitting the API route directly. Require EITHER a valid session
 * or a configured secret, so the route is never open-by-default.
 */
export async function requireSessionOrSecret(request: Request): Promise<NextResponse<ApiErrorEnvelope> | null> {
  const session = await getSession();
  if (session) return null;

  return requireSecret(request);
}
