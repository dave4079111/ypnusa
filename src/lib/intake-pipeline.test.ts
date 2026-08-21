import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { IntakeSessionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-intake-pipeline-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.INTAKE_EXTERNAL_WEBHOOK_URL;
delete process.env.OUTREACH_WEBHOOK_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;
delete process.env.MLO_CALENDAR_CONFIG_JSON;
delete process.env.CENSUS_API_BASE;
delete process.env.RENTAL_DEMAND_API_URL;
delete process.env.COUNTY_EVENTS_API_URL;

function buildSession(overrides: Partial<IntakeSessionRecord> = {}): IntakeSessionRecord {
  return {
    id: "sess_zip_test",
    createdAt: new Date().toISOString(),
    funnelSource: "unit_test_funnel",
    loanProgram: "FHA",
    status: "collecting",
    answers: {
      loanProgram: "FHA",
      name: "Taylor Borrower",
      email: "taylor@example.com",
      phone: "+15555550123",
      timeline: "1_3_months",
      estimatedCreditBand: "670-739",
      purchaseRefiIntent: "purchase",
      contactConsent: true,
      zip: "92672",
    },
    ...overrides,
  };
}

describe("finalizeIntakeArtifacts lead intelligence connection", async () => {
  const { finalizeIntakeArtifacts } = await import("./intake-pipeline");
  const { readDb } = await import("./db");

  after(() => {
    delete process.env.COUNTY_LOOKUP_API_URL;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("computes and persists predictive intelligence for a completed lead with a ZIP", async () => {
    const result = await finalizeIntakeArtifacts(buildSession());

    assert.ok("borrowerLeadId" in result);
    if (!("borrowerLeadId" in result)) return;

    const db = readDb();
    const event = db.analyticsEvents.find(
      (entry) =>
        entry.type === "lead_intelligence_computed" &&
        entry.payload.borrowerLeadId === result.borrowerLeadId,
    );
    assert.ok(event, "expected a lead_intelligence_computed analytics event");
    assert.equal(typeof event?.payload.leadScore, "number");
    assert.equal(typeof event?.payload.lifeEventLikelihood, "number");
    assert.equal(typeof event?.payload.followUpNecessity, "number");
    assert.ok(event?.payload.nextAction);
  });

  it("skips intelligence computation when the borrower ZIP is unknown (not currently collected by intake)", async () => {
    const session = buildSession({ id: "sess_no_zip" });
    session.answers = { ...session.answers, zip: undefined };

    const result = await finalizeIntakeArtifacts(session);

    assert.ok("borrowerLeadId" in result);
    if (!("borrowerLeadId" in result)) return;

    const db = readDb();
    const event = db.analyticsEvents.find(
      (entry) =>
        entry.type === "lead_intelligence_computed" &&
        entry.payload.borrowerLeadId === result.borrowerLeadId,
    );
    assert.equal(event, undefined);
  });

  it("still creates the lead and CRM artifacts when the intelligence provider call fails", async () => {
    process.env.COUNTY_LOOKUP_API_URL = "http://127.0.0.1:1/unreachable";

    const result = await finalizeIntakeArtifacts(buildSession({ id: "sess_zip_provider_error" }));

    assert.ok("borrowerLeadId" in result);
    if (!("borrowerLeadId" in result)) return;
    assert.ok(result.borrowerLeadId);
    assert.ok(result.crmLeadId);
    assert.ok(result.assignedOfficer);
  });

  it("is idempotent — replaying a synced session does not recompute or duplicate intelligence", async () => {
    const first = await finalizeIntakeArtifacts(buildSession({ id: "sess_zip_replay" }));
    assert.ok("borrowerLeadId" in first);
    if (!("borrowerLeadId" in first)) return;

    const eventsAfterFirst = readDb().analyticsEvents.filter(
      (entry) => entry.type === "lead_intelligence_computed",
    ).length;

    const syncedSession = buildSession({
      id: "sess_zip_replay",
      status: "crm_synced",
      borrowerLeadId: first.borrowerLeadId,
      crmLeadId: first.crmLeadId,
    });
    const replay = await finalizeIntakeArtifacts(syncedSession);
    assert.ok("alreadyCompleted" in replay && replay.alreadyCompleted === true);

    const eventsAfterReplay = readDb().analyticsEvents.filter(
      (entry) => entry.type === "lead_intelligence_computed",
    ).length;
    assert.equal(eventsAfterReplay, eventsAfterFirst);
  });
});
