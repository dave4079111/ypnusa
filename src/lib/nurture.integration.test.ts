import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { BorrowerAnswers, BorrowerLeadRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-nurture-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.MLO_CALENDAR_CONFIG_JSON;
delete process.env.OUTREACH_WEBHOOK_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;

const answers: BorrowerAnswers = {
  loanProgram: "CONVENTIONAL",
  name: "Taylor Borrower",
  email: "taylor@example.com",
  phone: "+15555550123",
  contactConsent: true,
  timeline: "1_3_months",
  estimatedCreditBand: "670-739",
  purchaseRefiIntent: "purchase",
};

const lead: BorrowerLeadRecord = {
  id: "lead_nurture_test",
  createdAt: new Date().toISOString(),
  answers,
  qualification: {
    programScores: { overallScore: 82 },
    leadQuality: "strong",
    urgency: "high",
    recommendedNextStep: "Book a consultation.",
    rationale: [],
  },
  assignedLoId: "lo_jordan_lee",
  crmLeadId: "crm_nurture_test",
};

describe("borrower nurture and booking integration", async () => {
  const { readDb, writeDb, appendLoAlert, appendCrmLead } = await import("./db");
  const { processDueFollowUps, scheduleBorrowerJourney } = await import("./automation");
  const { bookAppointment, listSyncedAvailableSlots } = await import("./calendar");
  const { buildNurtureDashboard } = await import("./nurture-dashboard");

  before(() => {
    writeDb((db) => {
      db.borrowerLeads = [lead];
      db.followUps = [];
      db.appointments = [];
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("requires consent before scheduling outreach", () => {
    const scheduled = scheduleBorrowerJourney("no_consent", {
      ...answers,
      contactConsent: false,
    });
    assert.equal(scheduled.length, 0);
  });

  it("delivers both immediate touches and retains the 30/60/90-day sequence", async () => {
    const scheduled = scheduleBorrowerJourney(lead.id, answers);
    assert.equal(scheduled.length, 8);
    assert.deepEqual(
      scheduled.slice(-3).map((item) => item.plan),
      ["day_30_check_in", "day_60_check_in", "day_90_check_in"],
    );

    const result = await processDueFollowUps({ borrowerLeadId: lead.id, limit: 2 });
    assert.equal(result.processed, 2);
    assert.equal(result.failed, 0);

    const delivered = readDb().followUps.filter((item) => item.status === "sent");
    assert.equal(delivered.length, 2);
    assert.ok(delivered.every((item) => item.deliveryProvider === "demo"));
  });

  it("books an available slot with a meeting link and surfaces it in the dashboard", async () => {
    const slot = (await listSyncedAvailableSlots(lead.assignedLoId, 8))[0];
    assert.ok(slot);

    const appointment = await bookAppointment({
      borrowerLeadId: lead.id,
      loId: lead.assignedLoId,
      startIso: slot.start,
      notes: "Integration test",
    });

    assert.equal(appointment.provider, "local");
    assert.match(appointment.meetingUrl ?? "", /^https:\/\/meet\.jit\.si\//);

    const dashboard = buildNurtureDashboard(lead.assignedLoId);
    assert.equal(dashboard.totals.upcomingAppointments, 1);
    assert.equal(dashboard.rows[0].state, "Appointment booked");
  });

  it("orders the portal queue by urgency and then lead score", () => {
    const rankedLeads: BorrowerLeadRecord[] = [
      lead,
      {
        ...lead,
        id: "lead_low_score_99",
        qualification: {
          ...lead.qualification,
          urgency: "low",
          programScores: { overallScore: 99 },
        },
      },
      {
        ...lead,
        id: "lead_critical_score_10",
        qualification: {
          ...lead.qualification,
          urgency: "critical",
          programScores: { overallScore: 10 },
        },
      },
      {
        ...lead,
        id: "lead_high_score_90",
        qualification: {
          ...lead.qualification,
          programScores: { overallScore: 90 },
        },
      },
    ];
    writeDb((db) => {
      db.borrowerLeads = rankedLeads;
    });

    const dashboard = buildNurtureDashboard(lead.assignedLoId);
    assert.deepEqual(
      dashboard.rows.map((row) => row.leadId),
      [
        "lead_critical_score_10",
        "lead_high_score_90",
        "lead_nurture_test",
        "lead_low_score_99",
      ],
    );
  });

  it("surfaces an agent escalation only past the initial routing alert, ranked ahead of urgency/score", () => {
    const rankedLeads: BorrowerLeadRecord[] = [
      { ...lead, id: "lead_no_escalation", qualification: { ...lead.qualification, urgency: "critical" } },
      { ...lead, id: "lead_escalated", qualification: { ...lead.qualification, urgency: "low" } },
    ];
    writeDb((db) => {
      db.borrowerLeads = rankedLeads;
      db.loAlerts = [];
    });

    // Every lead gets one routing alert on intake — that alone should not count as an escalation.
    appendLoAlert({
      id: "alert_routing_no_escalation",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      loId: lead.assignedLoId,
      borrowerLeadId: "lead_no_escalation",
      loanProgram: answers.loanProgram,
      summary: "routing",
      qualificationSummary: lead.qualification,
      suggestedAction: "Initial routing",
    });
    // This lead gets a second, later alert — a real agent escalation.
    appendLoAlert({
      id: "alert_routing_escalated",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      loId: lead.assignedLoId,
      borrowerLeadId: "lead_escalated",
      loanProgram: answers.loanProgram,
      summary: "routing",
      qualificationSummary: lead.qualification,
      suggestedAction: "Initial routing",
    });
    appendLoAlert({
      id: "alert_agent_escalation",
      createdAt: new Date().toISOString(),
      loId: lead.assignedLoId,
      borrowerLeadId: "lead_escalated",
      loanProgram: answers.loanProgram,
      summary: "escalation",
      qualificationSummary: lead.qualification,
      suggestedAction: "Predictive outcome signal flags high follow-up necessity (88/100).",
    });

    const dashboard = buildNurtureDashboard(lead.assignedLoId);
    const noEscalationRow = dashboard.rows.find((row) => row.leadId === "lead_no_escalation");
    const escalatedRow = dashboard.rows.find((row) => row.leadId === "lead_escalated");

    assert.equal(noEscalationRow?.aiEscalation, undefined);
    assert.equal(
      escalatedRow?.aiEscalation?.reason,
      "Predictive outcome signal flags high follow-up necessity (88/100).",
    );
    // Escalated (low urgency) still ranks ahead of the critical-urgency, non-escalated lead.
    assert.deepEqual(dashboard.rows.map((row) => row.leadId), ["lead_escalated", "lead_no_escalation"]);
  });

  it("surfaces the latest agent-authored CRM note, ignoring the static intake notes", () => {
    writeDb((db) => {
      db.borrowerLeads = [lead];
      db.crmLeads = [];
    });
    appendCrmLead({
      id: "crm_agent_note_test",
      createdAt: new Date().toISOString(),
      borrowerLeadId: lead.id,
      assignedLoId: lead.assignedLoId,
      status: "new_ai_routed",
      notes: ["Funnel cohort: unit_test", "Agent ▸ Called, left voicemail."],
      qualificationSnapshot: lead.qualification,
    });

    const dashboard = buildNurtureDashboard(lead.assignedLoId);
    const row = dashboard.rows.find((item) => item.leadId === lead.id);
    assert.equal(row?.latestAgentNote, "Agent ▸ Called, left voicemail.");
  });
});
