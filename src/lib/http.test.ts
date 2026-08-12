import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonError, jsonOk, parseJsonBody, requireSecret } from "./http";

function post(headers: Record<string, string> = {}): Request {
  return new Request("https://app.ypnus.com/api/test", { method: "POST", headers });
}

describe("requireSecret", () => {
  it("denies when no secret is configured", () => {
    delete process.env.ADMIN_TOKEN;
    delete process.env.CRON_SECRET;

    const response = requireSecret(post());

    assert.equal(response?.status, 401);
  });

  it("denies a wrong secret and allows the configured one", () => {
    process.env.ADMIN_TOKEN = "top-secret";

    assert.equal(requireSecret(post({ authorization: "Bearer nope" }))?.status, 401);
    assert.equal(requireSecret(post({ authorization: "Bearer top-secret" })), null);
    assert.equal(requireSecret(post({ "x-admin-token": "top-secret" })), null);

    delete process.env.ADMIN_TOKEN;
  });
});

describe("http helpers", () => {
  it("returns a structured success envelope", async () => {
    const response = jsonOk({ value: 42 });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, value: 42 });
  });

  it("returns a structured error envelope with an optional code", async () => {
    const response = jsonError("Nope.", 418, "TEAPOT");

    assert.equal(response.status, 418);
    assert.deepEqual(await response.json(), { ok: false, error: "Nope.", code: "TEAPOT" });
  });

  it("parses valid JSON bodies and reports invalid JSON", async () => {
    const valid = await parseJsonBody<{ name: string }>(
      new Request("https://app.ypnus.com/api/test", {
        method: "POST",
        body: JSON.stringify({ name: "YPN" }),
      }),
    );
    const invalid = await parseJsonBody(
      new Request("https://app.ypnus.com/api/test", {
        method: "POST",
        body: "{",
      }),
    );

    assert.deepEqual(valid, { ok: true, data: { name: "YPN" } });
    assert.deepEqual(invalid, {
      ok: false,
      error: "Request body must be JSON.",
      code: "INVALID_JSON",
    });
  });
});
