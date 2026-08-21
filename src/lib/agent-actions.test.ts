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

test("blocks an action kind outside the policy's autonomous set, never invoking the executor", async () => {
  // escalate_to_mlo is deliberately absent from DEFAULT_AGENT_ACTION_POLICY.autonomous —
  // this is the "safety" boundary: a decision layer (today deterministic, later an LLM)
  // proposing an action the policy hasn't cleared must not reach real side effects.
  const action: AgentAction = {
    id: "a4",
    kind: "escalate_to_mlo",
    reason: "requested by decision layer",
    payload: {},
  };

  let called = false;
  const result = await executeAgentAction(action, baseContext(), async () => {
    called = true;
    return { ok: true, actionId: "a4", message: "should never run" };
  });

  assert.equal(called, false, "the executor must not run for a policy-disallowed action kind");
  assert.equal(result.ok, false);
});

test("blocks routing a lead that hasn't been qualified yet", async () => {
  const action: AgentAction = {
    id: "a5",
    kind: "route_lead",
    reason: "requested by decision layer",
    payload: {},
  };

  const context: AgentContext = {
    state: {
      lifecycle: "qualified",
      answers: { loanProgram: "FHA", contactConsent: true },
      recentFollowUps: [],
      currentObjective: "route",
      updatedAt: new Date().toISOString(),
      // qualification intentionally omitted
    },
  };

  let called = false;
  const result = await executeAgentAction(action, context, async () => {
    called = true;
    return { ok: true, actionId: "a5", message: "should never run" };
  });

  assert.equal(called, false);
  assert.equal(result.ok, false);
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
