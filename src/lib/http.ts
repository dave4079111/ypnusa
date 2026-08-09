import { NextResponse } from "next/server";

export interface ApiErrorEnvelope {
  ok: false;
  error: string;
  code?: string;
}

export type ParseJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function jsonOk<T extends Record<string, unknown>>(
  body: T,
  init?: ResponseInit,
): NextResponse<{ ok: true } & T> {
  return NextResponse.json({ ok: true, ...body }, init);
}

export function jsonError(
  error: string,
  status = 500,
  code?: string,
  init?: Omit<ResponseInit, "status">,
): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json({ ok: false, error, code }, { ...init, status });
}

export async function parseJsonBody<T = unknown>(request: Request): Promise<ParseJsonResult<T>> {
  try {
    return { ok: true, data: (await request.json()) as T };
  } catch {
    return { ok: false, error: "Request body must be JSON.", code: "INVALID_JSON" };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function logApiError(route: string, error: unknown): void {
  console.error(`[api] ${route} failed`, error);
}

export function requireConfiguredSecret(request: Request): NextResponse<ApiErrorEnvelope> | null {
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const required = [adminToken, cronSecret].filter((secret): secret is string => Boolean(secret));

  if (required.length === 0) return null;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const supplied = [
    request.headers.get("x-admin-token")?.trim(),
    request.headers.get("x-cron-secret")?.trim(),
    bearer,
  ].filter((secret): secret is string => Boolean(secret));

  if (supplied.some((secret) => required.includes(secret))) return null;

  return jsonError("Unauthorized.", 401, "UNAUTHORIZED");
}
