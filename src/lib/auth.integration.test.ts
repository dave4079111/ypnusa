import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-auth-"));
const secret = "sso-test-secret-that-is-longer-than-thirty-two-bytes";
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.SSO_JWT_SECRET = secret;
process.env.SSO_JWT_ISSUER = "https://ypnus.com";
process.env.SSO_JWT_AUDIENCE = "https://app.ypnus.com";
process.env.SSO_ALLOWED_ORIGIN = "https://ypnus.com";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

function jwt(payload: Record<string, unknown>, signingSecret = secret): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function claims(jti: string): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://ypnus.com",
    aud: "https://app.ypnus.com",
    sub: "wp_user_42",
    jti,
    iat: now,
    exp: now + 60,
    mlo: {
      id: "mlo_42",
      name: "Morgan Loan Officer",
      email: "MORGAN@example.com",
      paidAccess: "1",
      subscriptionStatus: "active",
      subscriptionTier: "pro",
      stripeCustomerId: "cus_42",
      stripeSubscriptionId: "sub_42",
      isAdmin: false,
      claimedZips: ["90210"],
    },
  };
}

describe("one-time SSO session flow", async () => {
  const callback = await import("../app/api/auth/sso/callback/route");
  const sessionRoute = await import("../app/api/auth/session/route");
  const logoutRoute = await import("../app/api/auth/logout/route");
  const { AUTH_COOKIE_NAME } = await import("./auth");
  const { readDb } = await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects a JWT signed with the wrong secret", async () => {
    const response = await callback.POST(
      new Request("http://localhost:3000/api/auth/sso/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://ypnus.com",
        },
        body: JSON.stringify({
          token: jwt(claims("wrong-signature"), "a-different-secret-that-is-also-long-enough"),
        }),
      }),
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "INVALID_SSO_SIGNATURE");
  });

  it("creates an HTTP-only session, verifies it, prevents replay, and logs out", async () => {
    const token = jwt(claims("one-time-jti"));
    const callbackRequest = () =>
      new Request("http://localhost:3000/api/auth/sso/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://ypnus.com",
        },
        body: JSON.stringify({ token }),
      });

    const response = await callback.POST(callbackRequest());
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "http://localhost:3000/dashboard");
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const sessionId = setCookie.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`))?.[1];
    assert.ok(sessionId);

    const verified = await sessionRoute.GET(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${sessionId}` },
      }),
    );
    assert.equal(verified.status, 200);
    const verifiedBody = await verified.json();
    assert.equal(verifiedBody.profile.email, "morgan@example.com");
    assert.equal(verifiedBody.profile.paidAccess, true);
    assert.equal(verifiedBody.profile.subscriptionTier, "pro");
    const subscription = readDb().revenueSubscriptions.find(
      (item) => item.stripeSubscriptionId === "sub_42",
    );
    assert.equal(subscription?.source, "stripe");
    assert.equal(subscription?.ownerLoId, "mlo_42");

    const replay = await callback.POST(callbackRequest());
    assert.equal(replay.status, 409);
    assert.equal((await replay.json()).code, "SSO_TOKEN_REPLAYED");

    const logout = await logoutRoute.POST(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `${AUTH_COOKIE_NAME}=${sessionId}`,
          Origin: "http://localhost:3000",
        },
      }),
    );
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i);

    const afterLogout = sessionRoute.GET(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${sessionId}` },
      }),
    );
    assert.equal(afterLogout.status, 401);
  });
});
