import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { AgentAction, AgentContext } from "./agent-types";
import type { BorrowerLeadRecord, CrmLeadRecord, ScheduledFollowUpRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-agent-executor-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.OUTREACH_WEBHOOK_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;

describe("agent-executor.ts defaultAgentExecutor", async () => {
  const { defaultAgentExecutor } = await import("./agent-executor");
  const { appendBorrowerLead, appendCrmLead, persistFollowUpsBatch, readDb } = await import("./db");

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

  function buildCrm(borrowerLeadId: string): CrmLeadRecord {
    return {
      id: `crm_${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      borrowerLeadId,
      assignedLoId: "lo_jordan_lee",
      status: "new_ai_routed",
      notes: [],
      qualificationSnapshot: buildLead().qualification,
    };
  }

  function contextFor(lead: BorrowerLeadRecord): AgentContext {
    return {
      state: {
        leadId: lead.id,
        lifecycle: "routed",
        answers: lead.answers,
        recentFollowUps: [],
        currentObjective: "test",
        updatedAt: new Date().toISOString(),
      },
      borrowerLead: lead,
    };
  }

  function action(kind: AgentAction["kind"], payload: Record<string, unknown> = {}): AgentAction {
    return { id: `test_${kind}`, kind, reason: "test", payload };
  }

  it("add_crm_note appends a note to the matching CRM lead", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    appendCrmLead(buildCrm(lead.id));

    const result = await defaultAgentExecutor(action("add_crm_note", { note: "Called, left voicemail." }), contextFor(lead));

    assert.equal(result.ok, true);
    const crm = readDb().crmLeads.find((item) => item.borrowerLeadId === lead.id);
    assert.ok(crm?.notes.some((note) => note.includes("Called, left voicemail.")));
  });

  it("add_crm_note fails cleanly when no CRM lead exists yet", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);

    const result = await defaultAgentExecutor(action("add_crm_note"), contextFor(lead));

    assert.equal(result.ok, false);
  });

  it("cancel_followups marks pending jobs cancelled and leaves others untouched", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const pending: ScheduledFollowUpRecord = {
      id: "fu_pending",
      borrowerLeadId: lead.id,
      plan: "day_1_educational_email",
      channel: "email",
      recipient: "taylor@example.com",
      scheduledAt: new Date().toISOString(),
      status: "pending",
      bodySummary: "x",
      createdAt: new Date().toISOString(),
    };
    const alreadySent: ScheduledFollowUpRecord = {
      ...pending,
      id: "fu_sent",
      status: "sent",
    };
    persistFollowUpsBatch([pending, alreadySent]);

    const result = await defaultAgentExecutor(action("cancel_followups"), contextFor(lead));

    assert.equal(result.ok, true);
    assert.equal(result.data?.cancelled, 1);
    const db = readDb();
    assert.equal(db.followUps.find((f) => f.id === "fu_pending")?.status, "cancelled");
    assert.equal(db.followUps.find((f) => f.id === "fu_sent")?.status, "sent");
  });

  it("alert_mlo notifies the assigned officer using context.borrowerLead", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);

    const result = await defaultAgentExecutor(action("alert_mlo"), contextFor(lead));

    assert.equal(result.ok, true);
    const db = readDb();
    assert.ok(db.loAlerts.some((alert) => alert.borrowerLeadId === lead.id));
  });

  it("alert_mlo fails cleanly when context has no borrowerLead", async () => {
    const lead = buildLead();
    const ctx = contextFor(lead);
    const result = await defaultAgentExecutor(action("alert_mlo"), { ...ctx, borrowerLead: undefined });
    assert.equal(result.ok, false);
  });

  it("route_lead reports the current assignment without re-routing", async () => {
    const lead = buildLead({ assignedLoId: "lo_priya_nandakumar" });
    appendBorrowerLead(lead);

    const result = await defaultAgentExecutor(action("route_lead"), contextFor(lead));

    assert.equal(result.ok, true);
    assert.equal(result.data?.assignedLoId, "lo_priya_nandakumar");
  });

  it("wait is always a no-op success", async () => {
    const lead = buildLead();
    const result = await defaultAgentExecutor(action("wait"), contextFor(lead));
    assert.equal(result.ok, true);
  });

  it("ask_question/clarify_answer/qualify_lead are no-ops post-intake", async () => {
    const lead = buildLead();
    for (const kind of ["ask_question", "clarify_answer", "qualify_lead"] as const) {
      const result = await defaultAgentExecutor(action(kind), contextFor(lead));
      assert.equal(result.ok, true);
    }
  });

  it("book_appointment offers available slots for the assigned officer", async () => {
    const lead = buildLead();
    const result = await defaultAgentExecutor(action("book_appointment"), contextFor(lead));
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.data?.slots));
  });

  it("send_email fails cleanly when no pending email follow-up is queued", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const result = await defaultAgentExecutor(action("send_email"), contextFor(lead));
    assert.equal(result.ok, false);
  });
});
