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
  const { readDb, writeDb } = await import("./db");
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

  it("omits SMS when the subscriber tier does not include it", () => {
    const scheduled = scheduleBorrowerJourney("starter_email_only", answers, {
      smsEnabled: false,
    });
    assert.equal(scheduled.length, 7);
    assert.ok(scheduled.every((item) => item.channel === "email"));
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
});
