import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { APP_SITE_URL, MARKETING_SITE_URL } from "./site";

export const APP_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const WP_HANDOFF_MAX_AGE_SECONDS = 90;

export type AccountTier = "free" | "starter" | "pro" | "elite";

export interface WordpressHandoffClaims {
  token_use: "wp_sso";
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name: string;
  tier: AccountTier;
  subscription_status: string;
  roles: string[];
  jti: string;
  iat: number;
  exp: number;
}

export interface AppSessionClaims {
  token_use: "app_session";
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name: string;
  tier: AccountTier;
  subscriptionStatus: string;
  roles: string[];
  paidAccess: boolean;
  sid: string;
  iat: number;
  exp: number;
}

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

const HEADER: JwtHeader = { alg: "HS256", typ: "JWT" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeObject(segment: string): Record<string, unknown> {
  const decoded = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    throw new Error("Token segment must be a JSON object.");
  }
  return decoded as Record<string, unknown>;
}

function secretOrThrow(secret = process.env.YPNUS_SSO_SECRET): string {
  const normalized = secret?.trim() ?? "";
  if (normalized.length < 32) {
    throw new Error("YPNUS_SSO_SECRET must contain at least 32 characters.");
  }
  return normalized;
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function issue(payload: Record<string, unknown>, secret?: string): string {
  const signingSecret = secretOrThrow(secret);
  const input = `${encode(HEADER)}.${encode(payload)}`;
  return `${input}.${sign(input, signingSecret)}`;
}

function verify(token: string, secret?: string): Record<string, unknown> {
  if (token.length > 8192) throw new Error("Token is too large.");
  const segments = token.split(".");
  if (segments.length !== 3) throw new Error("Token is malformed.");
  const [headerSegment, payloadSegment, suppliedSignature] = segments;
  const header = decodeObject(headerSegment);
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Token algorithm is not allowed.");
  }

  const input = `${headerSegment}.${payloadSegment}`;
  const expected = Buffer.from(sign(input, secretOrThrow(secret)));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("Token signature is invalid.");
  }
  return decodeObject(payloadSegment);
}

function text(claims: Record<string, unknown>, key: string, maxLength: number): string {
  const value = claims[key];
  if (typeof value !== "string") throw new Error(`Token claim ${key} is invalid.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error(`Token claim ${key} is invalid.`);
  return trimmed;
}

function integer(claims: Record<string, unknown>, key: string): number {
  const value = claims[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Token claim ${key} is invalid.`);
  }
  return value;
}

function tier(value: unknown): AccountTier {
  if (value === "free" || value === "starter" || value === "pro" || value === "elite") {
    return value;
  }
  throw new Error("Token tier is invalid.");
}

function roles(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("Token roles are invalid.");
  return value.map((role) => {
    if (typeof role !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(role)) {
      throw new Error("Token roles are invalid.");
    }
    return role;
  });
}

function validateTimes(
  claims: Record<string, unknown>,
  nowSeconds: number,
  maxLifetimeSeconds: number,
): { iat: number; exp: number } {
  const iat = integer(claims, "iat");
  const exp = integer(claims, "exp");
  if (iat > nowSeconds + 30 || exp <= nowSeconds || exp - iat > maxLifetimeSeconds) {
    throw new Error("Token has expired or has an invalid lifetime.");
  }
  return { iat, exp };
}

export function createWordpressHandoffToken(
  input: Omit<WordpressHandoffClaims, "token_use" | "iss" | "aud" | "iat" | "exp">,
  secret?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  return issue(
    {
      ...input,
      token_use: "wp_sso",
      iss: MARKETING_SITE_URL,
      aud: APP_SITE_URL,
      iat: nowSeconds,
      exp: nowSeconds + WP_HANDOFF_MAX_AGE_SECONDS,
    },
    secret,
  );
}

export function verifyWordpressHandoffToken(
  tokenValue: string,
  secret?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): WordpressHandoffClaims {
  const claims = verify(tokenValue, secret);
  if (claims.token_use !== "wp_sso") throw new Error("Token use is invalid.");
  if (text(claims, "iss", 200) !== MARKETING_SITE_URL) throw new Error("Token issuer is invalid.");
  if (text(claims, "aud", 200) !== APP_SITE_URL) throw new Error("Token audience is invalid.");
  const email = text(claims, "email", 320).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Token email is invalid.");
  const { iat, exp } = validateTimes(claims, nowSeconds, WP_HANDOFF_MAX_AGE_SECONDS);

  return {
    token_use: "wp_sso",
    iss: MARKETING_SITE_URL,
    aud: APP_SITE_URL,
    sub: text(claims, "sub", 100),
    email,
    name: text(claims, "name", 160),
    tier: tier(claims.tier),
    subscription_status: text(claims, "subscription_status", 40),
    roles: roles(claims.roles),
    jti: text(claims, "jti", 100),
    iat,
    exp,
  };
}

export function createAppSessionToken(
  handoff: WordpressHandoffClaims,
  secret?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const paidAccess =
    handoff.tier === "free" ||
    handoff.subscription_status === "active" ||
    handoff.subscription_status === "trialing";
  return issue(
    {
      token_use: "app_session",
      iss: APP_SITE_URL,
      aud: APP_SITE_URL,
      sub: handoff.sub,
      email: handoff.email,
      name: handoff.name,
      tier: handoff.tier,
      subscriptionStatus: handoff.subscription_status,
      roles: handoff.roles,
      paidAccess,
      sid: randomUUID(),
      iat: nowSeconds,
      exp: nowSeconds + APP_SESSION_MAX_AGE_SECONDS,
    },
    secret,
  );
}

export function verifyAppSessionToken(
  tokenValue: string,
  secret?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AppSessionClaims {
  const claims = verify(tokenValue, secret);
  if (claims.token_use !== "app_session") throw new Error("Token use is invalid.");
  if (text(claims, "iss", 200) !== APP_SITE_URL || text(claims, "aud", 200) !== APP_SITE_URL) {
    throw new Error("Session origin is invalid.");
  }
  const email = text(claims, "email", 320).toLowerCase();
  if (!EMAIL_RE.test(email) || typeof claims.paidAccess !== "boolean") {
    throw new Error("Session claims are invalid.");
  }
  const { iat, exp } = validateTimes(claims, nowSeconds, APP_SESSION_MAX_AGE_SECONDS);

  return {
    token_use: "app_session",
    iss: APP_SITE_URL,
    aud: APP_SITE_URL,
    sub: text(claims, "sub", 100),
    email,
    name: text(claims, "name", 160),
    tier: tier(claims.tier),
    subscriptionStatus: text(claims, "subscriptionStatus", 40),
    roles: roles(claims.roles),
    paidAccess: claims.paidAccess,
    sid: text(claims, "sid", 100),
    iat,
    exp,
  };
}

export function appSessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-ypnus_session" : "ypnus_session";
}
