import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "../app/api/webhooks/leads/route";

describe("inbound lead webhook", () => {
  it("rejects non-object JSON with a structured client error", async () => {
    const request = new Request("http://localhost/api/webhooks/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });

    const response = await POST(request);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Request body must be a JSON object.",
      code: "INVALID_BODY",
    });
  });
});
