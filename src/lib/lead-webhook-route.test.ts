import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-lead-webhook-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.MLO_LEAD_WEBHOOK_SECRET = "lead-webhook-test-secret-that-is-at-least-32-bytes";

describe("inbound lead webhook", async () => {
  const { POST } = await import("../app/api/webhooks/leads/route");
  const { readDb } = await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects non-object JSON with a structured client error", async () => {
    const request = new Request("http://localhost/api/webhooks/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MLO_LEAD_WEBHOOK_SECRET}`,
        "Content-Type": "application/json",
      },
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

  it("normalizes, assigns, persists, nurtures, and deduplicates an MLO lead", async () => {
    const payload = {
      eventId: "webform_evt_1001",
      mlo: {
        id: "mlo_ada",
        name: " Ada Lovelace ",
        email: "ADA@EXAMPLE.COM",
        nmlsId: "123456",
        company: "Analytical Lending",
        claimedZips: ["78701", "bad"],
      },
      borrower: {
        name: " Grace Hopper ",
        email: "GRACE@EXAMPLE.COM",
        phone: "+1 (555) 555-0123",
        loanProgram: "conventional",
        timeline: "1_3_months",
        estimatedCreditBand: "740+",
        purchaseRefiIntent: "purchase",
        contactConsent: true,
        funnelSource: "mlo_landing_page",
      },
    };
    const createRequest = () =>
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MLO_LEAD_WEBHOOK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

    const response = await POST(createRequest());
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.duplicate, false);
    assert.equal(body.followUpsQueued, 8);

    const db = readDb();
    assert.equal(db.mloLeadSubmissions.length, 1);
    assert.equal(db.mloLeadSubmissions[0].mlo.email, "ada@example.com");
    assert.deepEqual(db.mloLeadSubmissions[0].mlo.claimedZips, ["78701"]);
    const lead = db.borrowerLeads.find((item) => item.id === body.borrowerLeadId);
    assert.equal(lead?.assignedLoId, "mlo_ada");
    assert.equal(lead?.answers.email, "grace@example.com");
    assert.equal(
      db.followUps.filter((item) => item.borrowerLeadId === body.borrowerLeadId).length,
      8,
    );

    const replay = await POST(createRequest());
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).duplicate, true);
    assert.equal(readDb().mloLeadSubmissions.length, 1);
  });
});
