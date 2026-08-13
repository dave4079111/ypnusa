import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { clientKey, rateLimit } from "./rate-limit";

let keyCounter = 0;
function uniqueKey(): string {
  keyCounter += 1;
  return `test-key-${keyCounter}`;
}

describe("rateLimit", () => {
  afterEach(() => {
    mock.timers.reset();
  });

  it("allows requests up to the limit then reports a retry delay", () => {
    const key = uniqueKey();

    assert.deepEqual(rateLimit(key, 2, 60_000), { ok: true, retryAfter: 0 });
    assert.deepEqual(rateLimit(key, 2, 60_000), { ok: true, retryAfter: 0 });

    const blocked = rateLimit(key, 2, 60_000);
    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 60);
  });

  it("tracks each key in its own window", () => {
    const first = uniqueKey();
    const second = uniqueKey();

    assert.equal(rateLimit(first, 1, 60_000).ok, true);
    assert.equal(rateLimit(first, 1, 60_000).ok, false);
    assert.equal(rateLimit(second, 1, 60_000).ok, true);
  });

  it("starts a fresh window once the previous one expires", () => {
    mock.timers.enable({ apis: ["Date"], now: 0 });
    const key = uniqueKey();

    assert.equal(rateLimit(key, 1, 1_000).ok, true);
    assert.deepEqual(rateLimit(key, 1, 1_000), { ok: false, retryAfter: 1 });

    mock.timers.tick(1_001);
    assert.deepEqual(rateLimit(key, 1, 1_000), { ok: true, retryAfter: 0 });
  });

  it("falls back to safe defaults for a non-positive limit or window", () => {
    const key = uniqueKey();

    assert.equal(rateLimit(key, 0, 60_000).ok, true);
    assert.equal(rateLimit(key, -5, 60_000).ok, false, "an invalid limit collapses to 1");

    const nanWindow = uniqueKey();
    assert.equal(rateLimit(nanWindow, 1, Number.NaN).ok, true);
    assert.equal(rateLimit(nanWindow, 1, Number.NaN).retryAfter, 60, "defaults to a 60s window");
  });

  it("buckets blank keys together under a single unknown bucket", () => {
    assert.equal(rateLimit("   ", 1, 60_000).ok, true);
    assert.equal(rateLimit("", 1, 60_000).ok, false);
    assert.equal(rateLimit("unknown", 1, 60_000).ok, false);
  });
});

describe("clientKey", () => {
  function requestWith(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/demo-request", { headers });
  }

  it("prefers the first hop of x-forwarded-for", () => {
    assert.equal(
      clientKey(requestWith({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1 " })),
      "203.0.113.7",
    );
  });

  it("falls back to x-real-ip when the forwarded chain is unusable", () => {
    assert.equal(
      clientKey(requestWith({ "x-forwarded-for": " , 10.0.0.1", "x-real-ip": "198.51.100.9" })),
      "198.51.100.9",
    );
    assert.equal(clientKey(requestWith({ "x-real-ip": "198.51.100.9" })), "198.51.100.9");
  });

  it("returns 'unknown' when no proxy headers are present", () => {
    assert.equal(clientKey(requestWith({})), "unknown");
    assert.equal(clientKey(requestWith({ "x-real-ip": "   " })), "unknown");
  });
});
