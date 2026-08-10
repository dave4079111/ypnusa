import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { NextRequest } from "next/server";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-sso-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.YPNUS_SSO_SECRET = "test-only-sso-secret-with-at-least-32-characters";

describe("WordPress to app SSO", async () => {
  const {
    createAppSessionToken,
    createWordpressHandoffToken,
    appSessionCookieName,
    verifyAppSessionToken,
    verifyWordpressHandoffToken,
  } = await import("./auth");
  const { consumeSsoExchange } = await import("./db");
  const { GET } = await import("../app/auth/callback/route");
  const { proxy } = await import("../proxy");

  const handoffInput = {
    sub: "42",
    email: "mlo@example.com",
    name: "Morgan Loan Officer",
    tier: "pro" as const,
    subscription_status: "active",
    roles: ["subscriber"],
    jti: "handoff_primary",
  };

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("verifies a short-lived WordPress handoff and rejects tampering", () => {
    const token = createWordpressHandoffToken(handoffInput, undefined, 1_900_000_000);
    const claims = verifyWordpressHandoffToken(token, undefined, 1_900_000_030);
    assert.equal(claims.email, "mlo@example.com");
    assert.equal(claims.tier, "pro");

    const replacement = token.endsWith("a") ? "b" : "a";
    assert.throws(
      () => verifyWordpressHandoffToken(`${token.slice(0, -1)}${replacement}`, undefined, 1_900_000_030),
      /signature/i,
    );
  });

  it("rejects expired handoffs and consumes each JTI once", () => {
    const token = createWordpressHandoffToken(handoffInput, undefined, 1_900_000_000);
    assert.throws(
      () => verifyWordpressHandoffToken(token, undefined, 1_900_000_091),
      /expired/i,
    );
    assert.equal(consumeSsoExchange("one_time_jti", "2099-01-01T00:00:00.000Z"), true);
    assert.equal(consumeSsoExchange("one_time_jti", "2099-01-01T00:00:00.000Z"), false);
  });

  it("creates a host session with entitlement state", () => {
    const handoff = verifyWordpressHandoffToken(
      createWordpressHandoffToken(handoffInput, undefined, 1_900_000_000),
      undefined,
      1_900_000_010,
    );
    const session = verifyAppSessionToken(
      createAppSessionToken(handoff, undefined, 1_900_000_010),
      undefined,
      1_900_000_020,
    );
    assert.equal(session.paidAccess, true);
    assert.equal(session.subscriptionStatus, "active");

    const restricted = verifyWordpressHandoffToken(
      createWordpressHandoffToken(
        {
          ...handoffInput,
          jti: "handoff_restricted",
          subscription_status: "past_due",
        },
        undefined,
        1_900_000_000,
      ),
      undefined,
      1_900_000_010,
    );
    const restrictedSession = verifyAppSessionToken(
      createAppSessionToken(restricted, undefined, 1_900_000_010),
      undefined,
      1_900_000_020,
    );
    assert.equal(restrictedSession.paidAccess, false);
  });

  it("exchanges a valid callback once and sets an HttpOnly app cookie", () => {
    const token = createWordpressHandoffToken(
      { ...handoffInput, jti: "callback_once" },
      undefined,
    );
    const request = new NextRequest(
      `http://localhost/auth/callback?token=${encodeURIComponent(token)}`,
    );
    const response = GET(request);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "http://localhost/dashboard");
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=lax/i);

    const replay = GET(request);
    assert.equal(replay.status, 307);
    assert.match(replay.headers.get("location") ?? "", /token_already_used/);
  });

  it("protects dashboard pages and operational APIs at the proxy boundary", () => {
    const pageResponse = proxy(new NextRequest("http://localhost/dashboard"));
    assert.equal(pageResponse.status, 307);
    assert.equal(
      pageResponse.headers.get("location"),
      "https://ypnus.com/wp-admin/admin-post.php?action=ypnus_app_sso",
    );

    const apiResponse = proxy(new NextRequest("http://localhost/api/analytics/summary"));
    assert.equal(apiResponse.status, 401);

    const handoff = verifyWordpressHandoffToken(
      createWordpressHandoffToken(
        { ...handoffInput, jti: "proxy_session" },
        undefined,
        1_900_000_000,
      ),
      undefined,
      1_900_000_010,
    );
    const session = createAppSessionToken(handoff, undefined, 1_900_000_010);
    const authorized = proxy(
      new NextRequest("http://localhost/dashboard", {
        headers: { cookie: `${appSessionCookieName()}=${session}` },
      }),
    );
    assert.equal(authorized.status, 200);
    assert.equal(authorized.headers.get("x-middleware-next"), "1");
  });
});
