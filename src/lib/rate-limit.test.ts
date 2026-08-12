import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enforceRateLimit } from "./rate-limit";

function requestFrom(ip: string): Request {
  return new Request("https://app.ypnus.com/api/demo-request", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("enforceRateLimit", () => {
  it("allows calls under the limit and returns a 429 envelope past it", async () => {
    const options = { scope: "test-guard", limit: 2, message: "Slow down." };

    assert.equal(enforceRateLimit(requestFrom("203.0.113.10"), options), null);
    assert.equal(enforceRateLimit(requestFrom("203.0.113.10"), options), null);

    const blocked = enforceRateLimit(requestFrom("203.0.113.10"), options);
    assert.ok(blocked);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("Retry-After")) >= 0);
    assert.deepEqual(await blocked.json(), {
      ok: false,
      error: "Slow down.",
      code: "RATE_LIMITED",
    });
  });

  it("keys buckets per client", () => {
    const options = { scope: "test-guard-per-client", limit: 1, message: "Slow down." };

    assert.equal(enforceRateLimit(requestFrom("198.51.100.1"), options), null);
    assert.equal(enforceRateLimit(requestFrom("198.51.100.2"), options), null);
    assert.ok(enforceRateLimit(requestFrom("198.51.100.1"), options));
  });
});
