import { AUTH_COOKIE_NAME, AuthError, createSessionFromSso, verifySsoToken } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/site";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SESSION_TTL_SECONDS = 15 * 60;

function allowedOrigin(): string | undefined {
  return process.env.SSO_ALLOWED_ORIGIN?.trim() || undefined;
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || origin !== allowedOrigin()) return {};
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function originIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(allowedOrigin()) && (!origin || origin === allowedOrigin());
}

function errorResponse(request: Request, error: unknown) {
  const authError =
    error instanceof AuthError
      ? error
      : new AuthError("Unable to complete SSO.", "SSO_CALLBACK_FAILED", 500);
  return jsonError(authError.message, authError.status, authError.code, {
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : undefined;
}

async function tokenFromPost(request: Request): Promise<string | undefined> {
  const authorization = bearerToken(request);
  if (authorization) return authorization;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as unknown;
    return typeof body === "object" &&
      body !== null &&
      "token" in body &&
      typeof body.token === "string"
      ? body.token
      : undefined;
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const token = (await request.formData()).get("token");
    return typeof token === "string" ? token : undefined;
  }
  return undefined;
}

async function establishSession(request: Request, token: string | undefined) {
  if (!allowedOrigin()) {
    return jsonError("SSO is not configured.", 503, "SSO_NOT_CONFIGURED", {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!originIsAllowed(request)) {
    return jsonError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED", {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const limited = await distributedRateLimit(`sso:${clientKey(request)}`, 20, 60_000);
  if (!limited.ok) {
    return jsonError("Too many SSO attempts.", 429, "RATE_LIMITED", {
      headers: {
        ...corsHeaders(request),
        "Cache-Control": "no-store",
        "Retry-After": String(limited.retryAfter),
      },
    });
  }

  try {
    const sessionId = createSessionFromSso(verifySsoToken(token ?? ""));
    const response = NextResponse.redirect(appUrl("/dashboard"), 303);
    const configuredTtl = Number(process.env.MLO_SESSION_TTL_SECONDS ?? "");
    const maxAge =
      Number.isSafeInteger(configuredTtl) && configuredTtl > 0
        ? Math.min(configuredTtl, 24 * 60 * 60)
        : DEFAULT_SESSION_TTL_SECONDS;
    response.cookies.set(AUTH_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
      priority: "high",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    Object.entries(corsHeaders(request)).forEach(([key, value]) => {
      if (value !== undefined) response.headers.set(key, String(value));
    });
    return response;
  } catch (error) {
    return errorResponse(request, error);
  }
}

export function GET(request: Request) {
  return jsonError("Use POST for SSO callbacks.", 405, "METHOD_NOT_ALLOWED", {
    headers: {
      "Allow": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      ...corsHeaders(request),
    },
  });
}

export async function POST(request: Request) {
  if (!request.headers.get("origin")) {
    return jsonError("Origin is required.", 403, "ORIGIN_REQUIRED", {
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    return await establishSession(request, await tokenFromPost(request));
  } catch {
    return jsonError("Request body is invalid.", 400, "INVALID_BODY", {
      headers: {
        ...corsHeaders(request),
        "Cache-Control": "no-store",
      },
    });
  }
}

export function OPTIONS(request: Request) {
  if (!originIsAllowed(request)) {
    return jsonError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    },
  });
}
