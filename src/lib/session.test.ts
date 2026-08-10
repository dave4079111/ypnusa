import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { createSessionToken, verifySessionToken } from "./session";

const TEST_SECRET = "test-session-secret-do-not-use-in-prod";
process.env.SESSION_SECRET = TEST_SECRET;

function sign(payloadB64: string): string {
  return createHmac("sha256", TEST_SECRET).update(payloadB64).digest("base64url");
}

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken({ sub: "wp_42", email: "jordan@example.com", role: "mlo" });
    const payload = verifySessionToken(token);
    assert.ok(payload);
    assert.equal(payload?.sub, "wp_42");
    assert.equal(payload?.email, "jordan@example.com");
    assert.equal(payload?.role, "mlo");
    assert.ok(payload!.exp > payload!.iat);
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken({ sub: "wp_42", email: "jordan@example.com", role: "mlo" });
    const [payloadB64] = token.split(".");
    const tampered = `${payloadB64}.deadbeef`;
    assert.equal(verifySessionToken(tampered), null);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken({ sub: "wp_42", email: "jordan@example.com", role: "mlo" });
    const [, sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "wp_admin", email: "admin@example.com", role: "admin", iat: 0, exp: 9999999999 }),
    ).toString("base64url");
    assert.equal(verifySessionToken(`${forgedPayload}.${sig}`), null);
  });

  it("rejects malformed tokens", () => {
    assert.equal(verifySessionToken(null), null);
    assert.equal(verifySessionToken(""), null);
    assert.equal(verifySessionToken("not-a-token"), null);
    assert.equal(verifySessionToken("..."), null);
  });

  it("rejects a validly-signed token carrying an unrecognized role", () => {
    const now = Math.floor(Date.now() / 1000);
    const payloadB64 = Buffer.from(
      JSON.stringify({ sub: "wp_1", email: "x@example.com", role: "superadmin", iat: now, exp: now + 3600 }),
    ).toString("base64url");
    assert.equal(verifySessionToken(`${payloadB64}.${sign(payloadB64)}`), null);
  });

  it("rejects a validly-signed but expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const payloadB64 = Buffer.from(
      JSON.stringify({ sub: "wp_1", email: "x@example.com", role: "mlo", iat: now - 7200, exp: now - 3600 }),
    ).toString("base64url");
    assert.equal(verifySessionToken(`${payloadB64}.${sign(payloadB64)}`), null);
  });
});
