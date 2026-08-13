import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { BorrowerAnswers } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-intake-engine-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.INTAKE_EXTERNAL_WEBHOOK_URL;
delete process.env.OUTREACH_WEBHOOK_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;
delete process.env.MLO_CALENDAR_CONFIG_JSON;

/** Canned borrower replies keyed by the field the assistant asks for. */
const replies: Partial<Record<keyof BorrowerAnswers, string>> = {
  purchaseRefiIntent: "refinance",
  targetLoanAmountUsd: "500000",
  estimatedCreditBand: "670-739",
  timeline: "1_3_months",
  name: "Taylor Borrower",
  email: "taylor@example.com",
  phone: "+15555550123",
  contactConsent: "true",
};

describe("intake engine tick loop", async () => {
  const { intakeTick } = await import("./intake-engine");
  const { hydrateAnswers } = await import("./intake-engine");
  const { readDb } = await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** Answer prompts until the session syncs (or we exhaust a safety budget). */
  async function runSession(loanProgram: string, funnelSource?: string) {
    let response = await intakeTick({ loanProgram, funnelSource });
    const prompts: string[] = [];

    for (let step = 0; step < 30 && response.ok && response.phase === "collecting"; step += 1) {
      const active = response.activeStep;
      assert.ok(active, "a collecting response must carry an active step");
      prompts.push(active.id);
      const rawValue = replies[active.field];
      assert.ok(rawValue !== undefined, `no canned reply for ${String(active.field)}`);

      response = await intakeTick({
        sessionId: response.sessionId,
        loanProgram,
        incoming: { field: active.field, rawValue },
      });
    }

    return { response, prompts };
  }

  it("greets, walks the short conversational flow, and syncs a completed borrower", async () => {
    const { response, prompts } = await runSession("conventional", "unit_test_funnel");

    assert.equal(response.ok, true);
    assert.equal(response.phase, "crm_synced");
    assert.equal(response.loanProgram, "CONVENTIONAL");
    assert.equal(response.activeStep, null);
    assert.equal(response.progress.pct, 100);
    assert.deepEqual(prompts, [
      "borrower_goal",
      "target_amount",
      "timeline",
      "credit_band",
      "borrower_full_name",
      "borrower_phone",
      "borrower_email",
      "contact_consent",
    ]);

    assert.ok(response.qualification);
    assert.ok(response.crmArtifacts?.borrowerLeadId);
    assert.ok(response.crmArtifacts?.crmLeadId);
    assert.equal(response.crmArtifacts?.alreadyCompleted, false);
    assert.ok((response.crmArtifacts?.followUpsQueued ?? 0) > 0);
    assert.match(response.assistantMessage, /Lead aura/);
    assert.match(response.assistantMessage, /Live assignment/);

    const db = readDb();
    const session = db.sessions.find((entry) => entry.id === response.sessionId);
    assert.equal(session?.status, "crm_synced");
    assert.equal(session?.funnelSource, "unit_test_funnel");
    assert.equal(session?.answers.targetLoanAmountUsd, 500000);
    assert.equal(db.borrowerLeads.at(-1)?.id, response.crmArtifacts?.borrowerLeadId);
    assert.equal(db.crmLeads.at(-1)?.id, response.crmArtifacts?.crmLeadId);
    assert.equal(db.loAlerts.at(-1)?.borrowerLeadId, response.crmArtifacts?.borrowerLeadId);
    assert.ok(db.analyticsEvents.some((entry) => entry.type === "intake_started"));
    assert.ok(db.analyticsEvents.some((entry) => entry.type === "intake_completed"));
  });

  it("uses the same short flow for every funded program", async () => {
    const opening = await intakeTick({ loanProgram: "VA" });

    assert.equal(opening.ok, true);
    assert.match(opening.assistantMessage, /YPN USA intake assistant/);
    assert.equal(opening.activeStep?.id, "borrower_goal");
    assert.deepEqual(opening.progress, { pct: 0, completed: 0, totalApplicable: 8 });

    const second = await intakeTick({
      sessionId: opening.sessionId,
      loanProgram: "VA",
      incoming: { field: "purchaseRefiIntent", rawValue: "purchase" },
    });

    assert.ok(!second.assistantMessage.includes("intake assistant"));
    assert.equal(second.activeStep?.id, "target_amount");
  });

  it("replays booking artifacts without duplicating the lead once synced", async () => {
    const { response } = await runSession("CONVENTIONAL");
    const leadsAfterSync = readDb().borrowerLeads.length;

    const replay = await intakeTick({ sessionId: response.sessionId, loanProgram: "CONVENTIONAL" });

    assert.equal(replay.ok, true);
    assert.equal(replay.phase, "crm_synced");
    assert.equal(replay.crmArtifacts?.alreadyCompleted, true);
    assert.equal(replay.crmArtifacts?.borrowerLeadId, response.crmArtifacts?.borrowerLeadId);
    assert.ok((replay.slotPreview?.length ?? 0) > 0);
    assert.equal(readDb().borrowerLeads.length, leadsAfterSync);
  });

  it("locks a synced session against further answers", async () => {
    const { response } = await runSession("CONVENTIONAL");

    const rejected = await intakeTick({
      sessionId: response.sessionId,
      loanProgram: "CONVENTIONAL",
      incoming: { field: "name", rawValue: "Someone Else" },
    });

    assert.equal(rejected.ok, false);
    assert.match(rejected.error ?? "", /already flowed to LOS/);
    assert.equal(rejected.phase, "crm_synced");
    assert.equal(rejected.answers.name, "Taylor Borrower");
  });

  it("rejects an unfunded program lane", async () => {
    const response = await intakeTick({ loanProgram: "CRYPTO" });

    assert.equal(response.ok, false);
    assert.match(response.error ?? "", /funded program lane/);
    assert.equal(response.sessionId, "");
    assert.equal(response.loanProgram, "FHA");
    assert.equal(readDb().sessions.some((entry) => entry.id === ""), false);
  });

  it("rejects an unknown session id instead of silently starting over", async () => {
    const response = await intakeTick({ sessionId: "sess_missing", loanProgram: "FHA" });

    assert.equal(response.ok, false);
    assert.match(response.error ?? "", /Session stale/);
  });

  it("refuses to switch program lanes mid-session", async () => {
    const opening = await intakeTick({ loanProgram: "FHA" });

    const response = await intakeTick({ sessionId: opening.sessionId, loanProgram: "DSCR" });

    assert.equal(response.ok, false);
    assert.match(response.error ?? "", /Program lanes lock/);
    assert.equal(response.loanProgram, "FHA");
  });

  it("detects answers that arrive for a step the assistant is not asking about", async () => {
    const opening = await intakeTick({ loanProgram: "CONVENTIONAL" });

    const response = await intakeTick({
      sessionId: opening.sessionId,
      loanProgram: "CONVENTIONAL",
      incoming: { field: "email", rawValue: "taylor@example.com" },
    });

    assert.equal(response.ok, false);
    assert.match(response.error ?? "", /sequencing drifted/);
    assert.equal(response.activeStep?.id, "borrower_goal");
    assert.equal(response.answers.email, undefined);
  });

  it("re-asks the current step when the answer fails coercion", async () => {
    const opening = await intakeTick({ loanProgram: "CONVENTIONAL" });
    const response = await intakeTick({
      sessionId: opening.sessionId,
      loanProgram: "CONVENTIONAL",
      incoming: { field: "purchaseRefiIntent", rawValue: "refinance" },
    });

    assert.equal(response.ok, true);
    assert.equal(response.activeStep?.id, "target_amount");

    const invalid = await intakeTick({
      sessionId: opening.sessionId,
      loanProgram: "CONVENTIONAL",
      incoming: { field: "targetLoanAmountUsd", rawValue: "a lot" },
    });

    assert.equal(invalid.ok, false);
    assert.equal(invalid.activeStep?.id, "target_amount");
    assert.equal(invalid.assistantMessage, invalid.error);
    assert.equal(invalid.answers.targetLoanAmountUsd, undefined);
  });

  it("defaults the funnel source and echoes it back on every answer", async () => {
    const opening = await intakeTick({ loanProgram: "FHA", funnelSource: "   " });

    assert.equal(opening.answers.funnelSource, "loanpilot_ai_surface");
    assert.equal(
      readDb().sessions.find((entry) => entry.id === opening.sessionId)?.funnelSource,
      "loanpilot_ai_surface",
    );
  });

  it("hydrateAnswers pins the session program and funnel over stored answers", () => {
    const answers = hydrateAnswers({
      id: "sess_x",
      createdAt: "2026-02-02T00:00:00.000Z",
      funnelSource: "session_funnel",
      loanProgram: "JUMBO",
      status: "collecting",
      answers: { loanProgram: "FHA", funnelSource: "stale_funnel", name: "Taylor" },
    });

    assert.equal(answers.loanProgram, "JUMBO");
    assert.equal(answers.funnelSource, "session_funnel");
    assert.equal(answers.name, "Taylor");
  });
});
