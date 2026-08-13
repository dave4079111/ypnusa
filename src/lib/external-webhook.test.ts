import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
  mirrorIntakeToExternalWebhook,
  type ExternalWebhookPayload,
} from "./external-webhook";

const payload: ExternalWebhookPayload = {
  event: "intake.completed",
  receivedAt: "2026-02-02T00:00:00.000Z",
  borrowerLeadId: "lead_1",
  crmLeadId: "crm_1",
  sessionId: "sess_1",
  loanProgram: "CONVENTIONAL",
  funnelSource: "unit_test",
  answers: { loanProgram: "CONVENTIONAL", email: "taylor@example.com" },
  qualification: { leadQuality: "strong" },
  assignedOfficer: { id: "lo_a", name: "Officer A", email: "owner-a@example.com" },
  ingestStack: "loanapilot_next",
};

describe("external intake webhook mirror", () => {
  afterEach(() => {
    mock.restoreAll();
    delete process.env.INTAKE_EXTERNAL_WEBHOOK_URL;
  });

  function stubFetch(response: Response | (() => Promise<Response>)) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return typeof response === "function" ? response() : response;
    });
    return calls;
  }

  function silenceWarnings() {
    return mock.method(console, "warn", () => {});
  }

  it("does nothing when no webhook endpoint is configured", async () => {
    const calls = stubFetch(new Response(null, { status: 200 }));
    const warn = silenceWarnings();

    await mirrorIntakeToExternalWebhook(payload);

    assert.deepEqual(calls, []);
    assert.equal(warn.mock.callCount(), 0);
  });

  it("skips the placeholder endpoints shipped in .env.example", async () => {
    const calls = stubFetch(new Response(null, { status: 200 }));

    for (const endpoint of [
      "https://hooks.zapier.com/hooks/catch/YOUR-WEBHOOK-ID",
      "https://hooks.zapier.com/hooks/catch/YOUR_WEBHOOK_ID",
    ]) {
      process.env.INTAKE_EXTERNAL_WEBHOOK_URL = endpoint;
      await mirrorIntakeToExternalWebhook(payload);
    }

    assert.deepEqual(calls, []);
  });

  it("warns and skips an unparseable endpoint instead of throwing", async () => {
    process.env.INTAKE_EXTERNAL_WEBHOOK_URL = "not-a-url";
    const calls = stubFetch(new Response(null, { status: 200 }));
    const warn = silenceWarnings();

    await mirrorIntakeToExternalWebhook(payload);

    assert.deepEqual(calls, []);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0]?.arguments[1]), /invalid intake webhook URL/i);
  });

  it("posts the payload as JSON to a configured endpoint", async () => {
    process.env.INTAKE_EXTERNAL_WEBHOOK_URL = "https://hooks.example.com/intake";
    const calls = stubFetch(new Response(null, { status: 204 }));
    const warn = silenceWarnings();

    await mirrorIntakeToExternalWebhook(payload);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://hooks.example.com/intake");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(calls[0]?.init?.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), payload);
    assert.ok(calls[0]?.init?.signal, "an abort signal should bound the request");
    assert.equal(warn.mock.callCount(), 0);
  });

  it("logs the host but does not throw on a non-2xx response", async () => {
    process.env.INTAKE_EXTERNAL_WEBHOOK_URL = "https://hooks.example.com/intake";
    stubFetch(new Response("nope", { status: 500 }));
    const warn = silenceWarnings();

    await mirrorIntakeToExternalWebhook(payload);

    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(warn.mock.calls[0]?.arguments[2], {
      status: 500,
      host: "hooks.example.com",
    });
  });

  it("swallows transport failures because ingestion already persisted locally", async () => {
    process.env.INTAKE_EXTERNAL_WEBHOOK_URL = "https://hooks.example.com/intake";
    stubFetch(() => Promise.reject(new Error("socket hang up")));
    const warn = silenceWarnings();

    await mirrorIntakeToExternalWebhook(payload);

    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(warn.mock.calls[0]?.arguments[2], {
      error: "socket hang up",
      host: "hooks.example.com",
    });
  });
});
