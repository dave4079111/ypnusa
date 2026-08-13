import assert from "node:assert/strict";
import test from "node:test";
import { deriveLeadLifecycle } from "./lead-lifecycle";
import type { IntakeSessionRecord } from "./types";

const session = (status: IntakeSessionRecord["status"], answers: IntakeSessionRecord["answers"]): IntakeSessionRecord => ({
  id: "sess_test",
  createdAt: "2026-08-12T00:00:00.000Z",
  funnelSource: "test",
  loanProgram: "FHA",
  status,
  answers,
});

test("distinguishes engaged from qualifying intake", () => {
  assert.equal(deriveLeadLifecycle({ session: session("collecting", { loanProgram: "FHA" }) }), "engaged");
  assert.equal(deriveLeadLifecycle({ session: session("collecting", { loanProgram: "FHA", firstTimeBuyer: true }) }), "qualifying");
});

test("moves a synced lead into contacting while follow-ups are pending", () => {
  assert.equal(
    deriveLeadLifecycle({
      session: session("crm_synced", { loanProgram: "FHA" }),
      followUps: [
        {
          id: "fu1",
          borrowerLeadId: "lead1",
          plan: "immediate_sms_ack",
          channel: "sms",
          recipient: "+15555555555",
          scheduledAt: "2026-08-12T00:00:00.000Z",
          status: "pending",
          bodySummary: "ack",
          createdAt: "2026-08-12T00:00:00.000Z",
        },
      ],
    }),
    "contacting",
  );
});

test("gives terminal lifecycle facts priority", () => {
  assert.equal(deriveLeadLifecycle({ session: session("crm_synced", { loanProgram: "FHA" }), closed: true }), "closed");
  assert.equal(deriveLeadLifecycle({ session: session("crm_synced", { loanProgram: "FHA" }), lost: true }), "lost");
});
