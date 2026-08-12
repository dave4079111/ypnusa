import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "../app/api/webhooks/leads/route";

process.env.ADMIN_TOKEN = "test-admin-token";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("inbound lead webhook", () => {
  it("rejects callers without the configured secret", async () => {
    const response = await POST(request("null"));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Unauthorized.",
      code: "UNAUTHORIZED",
    });
  });

  it("rejects non-object JSON with a structured client error", async () => {
    const response = await POST(
      request("null", { authorization: "Bearer test-admin-token" }),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Request body must be a JSON object.",
      code: "INVALID_BODY",
    });
  });
});
