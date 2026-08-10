import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonError, jsonOk, parseJsonBody } from "./http";

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

  it("stops reading request bodies at the configured byte ceiling", async () => {
    const oversized = await parseJsonBody(
      new Request("https://app.ypnus.com/api/test", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(2048) }),
      }),
      1024,
    );
    assert.deepEqual(oversized, {
      ok: false,
      error: "Request body is too large.",
      code: "BODY_TOO_LARGE",
    });
  });
});
