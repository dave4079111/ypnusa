import assert from "node:assert/strict";
import test from "node:test";
import { executeAgentAction, validateAgentAction } from "./agent-actions";
import type { AgentAction, AgentContext } from "./agent-types";

const baseContext = (consent = true): AgentContext => ({
  state: {
    lifecycle: "routed",
    answers: { loanProgram: "FHA", contactConsent: consent },
    recentFollowUps: [],
    currentObjective: "connect borrower with loan officer",
    updatedAt: new Date().toISOString(),
  },
});

test("blocks outreach without borrower consent", async () => {
  const action: AgentAction = {
    id: "a1",
    kind: "send_sms",
    reason: "acknowledge lead",
    requiresConsent: true,
    payload: {},
  };

  assert.equal(validateAgentAction(action, baseContext(false)), "Borrower contact consent is required before outreach or booking.");
  const result = await executeAgentAction(action, baseContext(false), async () => ({ ok: true, actionId: "a1", message: "sent" }));
  assert.equal(result.ok, false);
});

test("allows consented outreach through the executor boundary", async () => {
  const action: AgentAction = {
    id: "a2",
    kind: "send_email",
    reason: "acknowledge lead",
    requiresConsent: true,
    payload: { template: "immediate_confirmation_email" },
  };

  let called = false;
  const result = await executeAgentAction(action, baseContext(true), async () => {
    called = true;
    return { ok: true, actionId: "a2", message: "sent" };
  });

  assert.equal(called, true);
  assert.equal(result.ok, true);
});

test("turns executor failures into safe action results", async () => {
  const action: AgentAction = {
    id: "a3",
    kind: "add_crm_note",
    reason: "record agent activity",
    payload: {},
  };

  const result = await executeAgentAction(action, baseContext(), async () => {
    throw new Error("provider down");
  });

  assert.equal(result.ok, false);
  assert.equal(result.actionId, "a3");
});
