import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { createSessionToken, SESSION_COOKIE_NAME } from "./session";

process.env.SESSION_SECRET = "test-proxy-secret";

function requestFor(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return new NextRequest(new URL(path, "https://app.ypnus.com"), { headers });
}

describe("proxy (dashboard gate)", () => {
  it("passes through public routes untouched", () => {
    const response = proxy(requestFor("/"));
    assert.equal(response.headers.get("location"), null);
  });

  it("redirects an unauthenticated visitor away from a protected route", () => {
    const response = proxy(requestFor("/dashboard/local-seo"));
    const location = response.headers.get("location");
    assert.ok(location);
    assert.match(location!, /\/login\?next=%2Fdashboard%2Flocal-seo/);
  });

  it("lets an authenticated request through to a protected route", () => {
    const token = createSessionToken({ sub: "wp_1", email: "jordan@example.com", role: "mlo" });
    const response = proxy(requestFor("/portal/nurture", token));
    assert.equal(response.headers.get("location"), null);
  });

  it("rejects a forged/garbage session cookie on a protected route", () => {
    const response = proxy(requestFor("/admin/revenue", "garbage.token"));
    assert.ok(response.headers.get("location")?.includes("/login"));
  });
});
