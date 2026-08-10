import { timingSafeEqual } from "node:crypto";
import { sessionIdFromRequest, verifySession } from "./auth";
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
  const maxBytes = 1_048_576;
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, error: "Request body is too large.", code: "BODY_TOO_LARGE" };
  }
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > maxBytes) {
      return { ok: false, error: "Request body is too large.", code: "BODY_TOO_LARGE" };
    }
    return { ok: true, data: JSON.parse(body) as T };
  } catch {
    return { ok: false, error: "Request body must be JSON.", code: "INVALID_JSON" };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function logApiError(route: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message.slice(0, 500) }
      : { name: "UnknownError" };
  console.error(`[api] ${route} failed`, detail);
}

function bearerValue(request: Request): string {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function secretsEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function requireBearerSecret(
  request: Request,
  environmentName: string,
): NextResponse<ApiErrorEnvelope> | null {
  const expected = process.env[environmentName]?.trim();
  if (!expected || Buffer.byteLength(expected) < 32) {
    return jsonError("Service authentication is not configured.", 503, "AUTH_NOT_CONFIGURED");
  }
  if (!secretsEqual(expected, bearerValue(request))) {
    return jsonError("Unauthorized.", 401, "UNAUTHORIZED");
  }
  return null;
}

export function requireAdminOrBearer(
  request: Request,
): NextResponse<ApiErrorEnvelope> | null {
  const session = verifySession(sessionIdFromRequest(request));
  if (session?.profile.isAdmin) return null;
  return requireBearerSecret(request, "ADMIN_TOKEN");
}
