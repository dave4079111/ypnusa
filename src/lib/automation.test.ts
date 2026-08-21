import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { BorrowerLeadRecord, ScheduledFollowUpRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-automation-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;
delete process.env.OUTREACH_WEBHOOK_URL;
delete process.env.COUNTY_LOOKUP_API_URL;
delete process.env.CENSUS_API_BASE;
delete process.env.RENTAL_DEMAND_API_URL;
delete process.env.COUNTY_EVENTS_API_URL;

function buildLead(overrides: Partial<BorrowerLeadRecord> = {}): BorrowerLeadRecord {
  return {
    id: `lead_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    funnelSource: "unit_test",
    assignedLoId: "lo_jordan_lee",
    crmLeadId: "crm_test",
    answers: {
      loanProgram: "FHA",
      name: "Taylor Borrower",
      email: "taylor@example.com",
      phone: "+15555550123",
      timeline: "1_3_months",
      estimatedCreditBand: "670-739",
      contactConsent: true,
    },
    qualification: {
      leadQuality: "strong",
      urgency: "high",
      programScores: { overallScore: 70 },
      recommendedNextStep: "Route to an MLO",
      rationale: [],
    },
    ...overrides,
  };
}

function buildFollowUp(borrowerLeadId: string, overrides: Partial<ScheduledFollowUpRecord> = {}): ScheduledFollowUpRecord {
  return {
    id: `fu_${Math.random().toString(36).slice(2, 10)}`,
    borrowerLeadId,
    plan: "day_1_educational_email",
    channel: "email",
    recipient: "taylor@example.com",
    scheduledAt: new Date(Date.now() - 60_000).toISOString(),
    status: "pending",
    bodySummary: "Education drip.",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("automation.ts outreach personalization connector", async () => {
  const { processDueFollowUps, scheduleBorrowerJourney } = await import("./automation");
  const { appendBorrowerLead, persistFollowUpsBatch, readDb } = await import("./db");

  let server: http.Server;
  let received: Array<{ body: string; subject: string; recipient: string }> = [];

  before(async () => {
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const parsed = JSON.parse(raw);
        received.push({ body: parsed.body, subject: parsed.subject, recipient: parsed.recipient });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: "webhook_msg_1" }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    process.env.OUTREACH_WEBHOOK_URL = `http://127.0.0.1:${port}/webhook`;
  });

  after(async () => {
    delete process.env.OUTREACH_WEBHOOK_URL;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    received = [];
  });

  it("includes ZIP-derived personalization in outreach copy when the lead has a ZIP", async () => {
    const lead = buildLead({ answers: { ...buildLead().answers, zip: "92672" } });
    appendBorrowerLead(lead);
    const followUp = buildFollowUp(lead.id);
    persistFollowUpsBatch([followUp]);

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

    assert.equal(summary.processed, 1);
    assert.equal(summary.failed, 0);
    assert.equal(received.length, 1);
    assert.match(
      received[0].body,
      /Every ZIP is different|Rental demand|Households in/,
      "expected the personalization line to be appended to the outreach body",
    );

    const job = readDb().followUps.find((entry) => entry.id === followUp.id);
    assert.equal(job?.status, "sent");
    assert.equal(job?.deliveryProvider, "webhook");
  });

  it("delivers successfully and omits personalization when the lead has no ZIP", async () => {
    const lead = buildLead();
    assert.equal(lead.answers.zip, undefined);
    appendBorrowerLead(lead);
    const followUp = buildFollowUp(lead.id);
    persistFollowUpsBatch([followUp]);

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

    assert.equal(summary.processed, 1);
    assert.equal(summary.failed, 0);
    assert.equal(received.length, 1);
    assert.equal(
      received[0].body.includes("Every ZIP is different"),
      false,
      "no ZIP means no personalization line should be appended",
    );

    const job = readDb().followUps.find((entry) => entry.id === followUp.id);
    assert.equal(job?.status, "sent");
  });

  it("falls back to demo delivery when no provider is configured", async () => {
    delete process.env.OUTREACH_WEBHOOK_URL;
    try {
      const lead = buildLead();
      appendBorrowerLead(lead);
      const followUp = buildFollowUp(lead.id);
      persistFollowUpsBatch([followUp]);

      const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

      assert.equal(summary.processed, 1);
      const job = readDb().followUps.find((entry) => entry.id === followUp.id);
      assert.equal(job?.status, "sent");
      assert.equal(job?.deliveryProvider, "demo");
    } finally {
      const port = (server.address() as AddressInfo).port;
      process.env.OUTREACH_WEBHOOK_URL = `http://127.0.0.1:${port}/webhook`;
    }
  });

  it("does not create duplicate follow-up jobs when processing", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const followUp = buildFollowUp(lead.id);
    persistFollowUpsBatch([followUp]);

    const countBefore = readDb().followUps.length;
    await processDueFollowUps({ borrowerLeadId: lead.id });
    const countAfter = readDb().followUps.length;

    assert.equal(countAfter, countBefore);
  });

  it("keeps the existing cadence and contactConsent gating unchanged", () => {
    const consented = scheduleBorrowerJourney("lead_consent_yes", {
      loanProgram: "FHA",
      contactConsent: true,
      email: "consent@example.com",
      phone: "+15555550199",
    });
    assert.equal(consented.length, 8);
    assert.deepEqual(
      consented.map((job) => job.plan),
      [
        "immediate_confirmation_email",
        "immediate_sms_ack",
        "day_1_educational_email",
        "day_3_book_call_email",
        "day_5_urgency_email",
        "day_30_check_in",
        "day_60_check_in",
        "day_90_check_in",
      ],
    );

    const declined = scheduleBorrowerJourney("lead_consent_no", {
      loanProgram: "FHA",
      contactConsent: false,
    });
    assert.equal(declined.length, 0);
  });
});
