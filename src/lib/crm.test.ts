import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { BorrowerAnswers, LoanOfficerRecord, QualificationSummary } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-crm-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const officers: LoanOfficerRecord[] = [
  { id: "lo_fha_a", name: "FHA A", email: "fha-a@example.com", specialties: ["FHA"], weeklyWindows: [] },
  { id: "lo_fha_b", name: "FHA B", email: "fha-b@example.com", specialties: ["FHA"], weeklyWindows: [] },
  { id: "lo_jumbo", name: "Jumbo", email: "jumbo@example.com", specialties: ["JUMBO"], weeklyWindows: [] },
];

const answers: BorrowerAnswers = {
  loanProgram: "FHA",
  name: "Taylor Borrower",
  email: "taylor@example.com",
  phone: "+15555550123",
  timeline: "1_3_months",
  estimatedCreditBand: "670-739",
};

const qualification: QualificationSummary = {
  programScores: { overallScore: 81.4 },
  leadQuality: "strong",
  urgency: "high",
  recommendedNextStep: "Fast LOS build.",
  rationale: ["one", "two", "three", "four", "five"],
};

describe("crm routing and activity log", async () => {
  const { readDb, writeDb } = await import("./db");
  const { logCrmActivity, routeLoanOfficer } = await import("./crm");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    writeDb((db) => {
      db.loanOfficers = officers;
      db.borrowerLeads = [];
      db.crmLeads = [];
    });
  });

  it("prefers a specialist for the requested program", () => {
    assert.equal(routeLoanOfficer("JUMBO").id, "lo_jumbo");
  });

  it("falls back to the whole roster when nobody specializes in the program", () => {
    assert.ok(
      officers.some((officer) => officer.id === routeLoanOfficer("DSCR").id),
      "an officer must still be assigned for an unspecialized program",
    );
  });

  it("balances new leads toward the least-loaded specialist", () => {
    const first = routeLoanOfficer("FHA");
    logCrmActivity(answers, qualification, first.id);

    const second = routeLoanOfficer("FHA");
    assert.notEqual(second.id, first.id);

    logCrmActivity(answers, qualification, second.id);
    assert.equal(routeLoanOfficer("FHA").id, first.id, "routing should return to the tied officer");
  });

  it("persists a linked borrower lead and CRM record with mirrored notes", () => {
    const result = logCrmActivity(answers, qualification, "lo_fha_a", "paid_search", "sess_123");
    const db = readDb();
    const lead = db.borrowerLeads.find((entry) => entry.id === result.borrowerLeadId);
    const crm = db.crmLeads.find((entry) => entry.id === result.crmLeadId);

    assert.match(result.borrowerLeadId, /^lead_/);
    assert.match(result.crmLeadId, /^crm_/);
    assert.equal(lead?.crmLeadId, result.crmLeadId);
    assert.equal(lead?.sessionId, "sess_123");
    assert.equal(lead?.funnelSource, "paid_search");
    assert.equal(lead?.assignedLoId, "lo_fha_a");
    assert.equal(crm?.borrowerLeadId, result.borrowerLeadId);
    assert.equal(crm?.status, "new_ai_routed");
    assert.deepEqual(crm?.qualificationSnapshot, qualification);
    assert.deepEqual(result.notes.slice(0, 4), [
      "Funnel cohort: paid_search",
      "LOS composite 81 / quality strong",
      "AI coaching: Fast LOS build.",
      "Session lineage: sess_123",
    ]);
    assert.equal(result.notes.length, 8, "at most four model notes are mirrored");
    assert.ok(result.notes.every((note) => typeof note === "string" && note.length > 0));
  });

  it("labels an anonymous funnel and falls back to the lead id for session lineage", () => {
    const result = logCrmActivity(answers, qualification, "lo_fha_a");

    assert.equal(result.notes[0], "Funnel cohort: unspecified_ai_channel");
    assert.equal(result.notes[3], `Session lineage: ${result.borrowerLeadId}`);
  });
});
