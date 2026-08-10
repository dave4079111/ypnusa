import fs from "fs";
import path from "path";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Signed, stateless session tokens for app.ypnus.com.
 *
 * The cookie this backs is intentionally host-only (no `domain` attribute), so it is
 * never sent to ypnus.com — application sessions live exclusively on this host.
 */

export type SessionRole = "mlo" | "admin";

export interface SessionPayload {
  /** Stable subject identifier (WordPress user id, or `dev_<email>` in local dev). */
  sub: string;
  email: string;
  role: SessionRole;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = "ypnus_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

/**
 * Fallback secret resolution when SESSION_SECRET isn't configured.
 *
 * Proxy and Route Handlers run as separate module instances (even on a single Node
 * host), so a purely in-memory random secret would sign tokens that the other side
 * can never verify. Persisting it to disk — same data dir as store.json — keeps every
 * process in agreement without requiring an env var, matching this project's "runs
 * fully without environment variables" default.
 */
let cachedDataDir: string | null = null;
function dataDir(): string {
  if (cachedDataDir) return cachedDataDir;
  const configured = process.env.LOANPILOT_DATA_DIR?.trim();
  cachedDataDir = configured || path.resolve(/*turbopackIgnore: true*/ "data");
  return cachedDataDir;
}

let cachedSecret: string | null = null;
let warnedMissingSecret = false;

function loadOrCreatePersistedSecret(): string {
  if (cachedSecret) return cachedSecret;
  const file = path.join(dataDir(), "session-secret.key");

  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing) {
      cachedSecret = existing;
      return cachedSecret;
    }
  } catch {
    // Doesn't exist yet or unreadable — generate below.
  }

  const generated = randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(file, generated, { mode: 0o600 });
  } catch {
    // Read-only/serverless filesystem: this process still works, but sessions won't
    // validate against other processes/instances until SESSION_SECRET is set.
  }
  cachedSecret = generated;
  return cachedSecret;
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[session] SESSION_SECRET is not set — falling back to a secret persisted at " +
        "<data dir>/session-secret.key. Set SESSION_SECRET explicitly in production.",
    );
  }
  return loadOrCreatePersistedSecret();
}

function sign(payloadB64: string): string {
  return createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function createSessionToken(user: { sub: string; email: string; role: SessionRole }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.sub,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) return null;

  if (!safeEqual(sig, sign(payloadB64))) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub || !payload.email || (payload.role !== "mlo" && payload.role !== "admin")) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
