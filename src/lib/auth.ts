import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readDb, writeDb } from "./db";
import type { MloSubscriberProfile } from "./types";

export const AUTH_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-ypnus_session" : "ypnus_session";

const DEFAULT_ISSUER = "https://ypnus.com";
const DEFAULT_AUDIENCE = "https://app.ypnus.com";
const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEFAULT_MAX_TOKEN_TTL_SECONDS = 5 * 60;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

interface VerifiedSsoToken {
  jti: string;
  expiresAt: string;
  profile: MloSubscriberProfile;
}

interface JsonRecord {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new AuthError(`SSO token is missing ${field}.`, "INVALID_SSO_CLAIMS", 401);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new AuthError(`SSO token has an invalid ${field}.`, "INVALID_SSO_CLAIMS", 401);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function decodeJsonSegment(segment: string, label: string): JsonRecord {
  try {
    const parsed = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;
    if (!isRecord(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new AuthError(`SSO token has an invalid ${label}.`, "INVALID_SSO_TOKEN", 401);
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function configuredPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? "");
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function validateAudience(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  return Array.isArray(aud) && aud.some((item) => item === expected);
}

function extractProfile(payload: JsonRecord): MloSubscriberProfile {
  const nested = isRecord(payload.mlo) ? payload.mlo : payload;
  const id = optionalText(nested.id, 160) ?? requiredText(payload.sub, "sub", 160);
  const name = requiredText(nested.name, "mlo.name", 160);
  const email = requiredText(nested.email, "mlo.email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("SSO token has an invalid MLO email.", "INVALID_SSO_CLAIMS", 401);
  }

  const paidAccess = nested.paidAccess ?? payload.paidAccess;
  if (paidAccess !== true && paidAccess !== "1" && paidAccess !== 1) {
    throw new AuthError("The MLO subscription is not active.", "SUBSCRIPTION_REQUIRED", 403);
  }

  const claimedZips = Array.isArray(nested.claimedZips)
    ? [...new Set(nested.claimedZips.filter((zip): zip is string => typeof zip === "string"))]
        .map((zip) => zip.trim())
        .filter((zip) => /^\d{5}$/.test(zip))
        .slice(0, 500)
    : [];

  return {
    id,
    name,
    email,
    paidAccess: true,
    nmlsId: optionalText(nested.nmlsId, 40),
    company: optionalText(nested.company, 160),
    subscriptionTier: optionalText(nested.subscriptionTier ?? nested.tier, 40),
    claimedZips,
  };
}

export function verifySsoToken(token: string, now = Date.now()): VerifiedSsoToken {
  const secret = process.env.SSO_JWT_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new AuthError("SSO is not configured.", "SSO_NOT_CONFIGURED", 503);
  }
  if (!token || token.length > 16_384) {
    throw new AuthError("SSO token is missing or too large.", "INVALID_SSO_TOKEN", 401);
  }

  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new AuthError("SSO token is malformed.", "INVALID_SSO_TOKEN", 401);
  }
  const [encodedHeader, encodedPayload, suppliedSignature] = segments;
  const header = decodeJsonSegment(encodedHeader, "header");
  if (header.alg !== "HS256" || (header.typ !== undefined && header.typ !== "JWT")) {
    throw new AuthError("SSO token algorithm is not allowed.", "INVALID_SSO_TOKEN", 401);
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  let signature: Buffer;
  try {
    signature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new AuthError("SSO token signature is invalid.", "INVALID_SSO_SIGNATURE", 401);
  }
  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(signature, expectedSignature)
  ) {
    throw new AuthError("SSO token signature is invalid.", "INVALID_SSO_SIGNATURE", 401);
  }

  const payload = decodeJsonSegment(encodedPayload, "payload");
  const issuer = process.env.SSO_JWT_ISSUER?.trim() || DEFAULT_ISSUER;
  const audience = process.env.SSO_JWT_AUDIENCE?.trim() || DEFAULT_AUDIENCE;
  if (payload.iss !== issuer || !validateAudience(payload.aud, audience)) {
    throw new AuthError("SSO token issuer or audience is invalid.", "INVALID_SSO_CLAIMS", 401);
  }

  const nowSeconds = Math.floor(now / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : Number.NaN;
  const iat = typeof payload.iat === "number" ? payload.iat : Number.NaN;
  const nbf = payload.nbf === undefined ? iat : payload.nbf;
  const maxTtl = configuredPositiveInteger(
    "SSO_JWT_MAX_TTL_SECONDS",
    DEFAULT_MAX_TOKEN_TTL_SECONDS,
  );
  if (
    !Number.isSafeInteger(exp) ||
    !Number.isSafeInteger(iat) ||
    !Number.isSafeInteger(nbf) ||
    exp <= nowSeconds ||
    iat > nowSeconds + 60 ||
    nbf > nowSeconds + 60 ||
    exp <= iat ||
    exp - iat > maxTtl
  ) {
    throw new AuthError("SSO token is expired or outside its allowed lifetime.", "EXPIRED_SSO_TOKEN", 401);
  }

  return {
    jti: requiredText(payload.jti, "jti", 200),
    expiresAt: new Date(exp * 1000).toISOString(),
    profile: extractProfile(payload),
  };
}

export function createSessionFromSso(verified: VerifiedSsoToken, now = Date.now()): string {
  const sessionId = randomBytes(32).toString("base64url");
  const sessionTtl = configuredPositiveInteger(
    "MLO_SESSION_TTL_SECONDS",
    DEFAULT_SESSION_TTL_SECONDS,
  );
  const jtiHash = hash(verified.jti);
  let replayed = false;

  writeDb((db) => {
    db.authSessions = db.authSessions.filter((session) => Date.parse(session.expiresAt) > now);
    db.consumedSsoTokens = db.consumedSsoTokens.filter(
      (consumed) => Date.parse(consumed.expiresAt) > now,
    );
    if (db.consumedSsoTokens.some((consumed) => consumed.jtiHash === jtiHash)) {
      replayed = true;
      return;
    }
    db.consumedSsoTokens.push({
      jtiHash,
      consumedAt: new Date(now).toISOString(),
      expiresAt: verified.expiresAt,
    });
    db.authSessions.push({
      idHash: hash(sessionId),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionTtl * 1000).toISOString(),
      profile: verified.profile,
    });
  });

  if (replayed) {
    throw new AuthError("SSO token has already been used.", "SSO_TOKEN_REPLAYED", 409);
  }
  return sessionId;
}

export function verifySession(sessionId: string | undefined, now = Date.now()) {
  if (!sessionId) return null;
  const idHash = hash(sessionId);
  const session = readDb().authSessions.find((candidate) => candidate.idHash === idHash);
  if (!session || Date.parse(session.expiresAt) <= now) return null;
  return session;
}

export function revokeSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  const idHash = hash(sessionId);
  writeDb((db) => {
    db.authSessions = db.authSessions.filter((session) => session.idHash !== idHash);
  });
}
