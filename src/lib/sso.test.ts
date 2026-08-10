import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifySsoHandoff } from "./sso";

const TEST_SECRET = "test-sso-shared-secret";

function sign(email: string, sub: string, role: string, iat: string, next: string, secret = TEST_SECRET): string {
  return createHmac("sha256", secret).update([email, sub, role, iat, next].join("|")).digest("base64url");
}

function buildUrl(overrides: Partial<Record<"email" | "sub" | "role" | "iat" | "next" | "sig", string>> = {}) {
  const email = overrides.email ?? "jordan@example.com";
  const sub = overrides.sub ?? "wp_42";
  const role = overrides.role ?? "mlo";
  const iat = overrides.iat ?? String(Math.floor(Date.now() / 1000));
  const next = overrides.next ?? "/dashboard";
  const sig = overrides.sig ?? sign(email, sub, role, iat, next);

  const url = new URL("https://app.ypnus.com/api/auth/callback");
  url.searchParams.set("email", email);
  url.searchParams.set("sub", sub);
  url.searchParams.set("role", role);
  url.searchParams.set("iat", iat);
  url.searchParams.set("next", next);
  url.searchParams.set("sig", sig);
  return url;
}

describe("SSO handoff verification", () => {
  it("fails closed when the shared secret isn't configured", () => {
    delete process.env.YPNUS_SSO_SHARED_SECRET;
    const result = verifySsoHandoff(buildUrl());
    assert.ok("error" in result);
  });

  it("accepts a correctly-signed, fresh handoff once the secret is configured", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const result = verifySsoHandoff(buildUrl());
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.email, "jordan@example.com");
      assert.equal(result.role, "mlo");
      assert.equal(result.next, "/dashboard");
    }
  });

  it("rejects a tampered signature", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const result = verifySsoHandoff(buildUrl({ sig: "0".repeat(43) }));
    assert.ok("error" in result);
  });

  it("rejects a signature produced with the wrong secret", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const badSig = sign("jordan@example.com", "wp_42", "mlo", String(Math.floor(Date.now() / 1000)), "/dashboard", "wrong-secret");
    const result = verifySsoHandoff(buildUrl({ sig: badSig }));
    assert.ok("error" in result);
  });

  it("rejects a stale token outside the freshness window", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const staleIat = String(Math.floor(Date.now() / 1000) - 600);
    const result = verifySsoHandoff(buildUrl({ iat: staleIat, sig: sign("jordan@example.com", "wp_42", "mlo", staleIat, "/dashboard") }));
    assert.ok("error" in result);
  });

  it("rejects an unrecognized role", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const iat = String(Math.floor(Date.now() / 1000));
    const result = verifySsoHandoff(
      buildUrl({ role: "superadmin", sig: sign("jordan@example.com", "wp_42", "superadmin", iat, "/dashboard") }),
    );
    assert.ok("error" in result);
  });

  it("rejects an open-redirect next target", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const iat = String(Math.floor(Date.now() / 1000));
    const result = verifySsoHandoff(
      buildUrl({ next: "//evil.example.com", sig: sign("jordan@example.com", "wp_42", "mlo", iat, "//evil.example.com") }),
    );
    assert.ok("error" in result);
  });
});
