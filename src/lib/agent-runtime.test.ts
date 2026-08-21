import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAgentTurn, runAgentTurn } from "./agent-runtime";
import type { AgentActionResult, LeadState } from "./agent-types";

function baseState(overrides: Partial<LeadState> = {}): LeadState {
  return {
    leadId: "lead_1",
    lifecycle: "contacting",
    answers: { loanProgram: "FHA" },
    recentFollowUps: [],
    currentObjective: "test",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("agent-runtime.ts", () => {
  it("forwards predictiveSignal into the decision layer (escalates on high follow-up necessity)", () => {
    const withoutSignal = planAgentTurn(baseState());
    assert.equal(withoutSignal.kind, "create_followup");

    const withSignal = planAgentTurn(baseState(), {
      predictiveSignal: {
        leadScore: 90,
        lifeEventLikelihood: 80,
        outcomeSignals: { followUpNecessity: 95 } as never,
      },
    });
    assert.equal(withSignal.kind, "alert_mlo");
  });

  it("runAgentTurn executes the planned action through the supplied executor", async () => {
    const calls: string[] = [];
    const result = await runAgentTurn(
      baseState({ lifecycle: "routed", answers: { loanProgram: "FHA", contactConsent: true } }),
      async (action) => {
        calls.push(action.kind);
        return { ok: true, actionId: action.id, message: "handled" } satisfies AgentActionResult;
      },
    );

    assert.equal(result.action.kind, "send_email");
    assert.deepEqual(calls, ["send_email"]);
    assert.equal(result.result?.ok, true);
  });

  it("runAgentTurn forwards borrowerLead/predictiveSignal to the executor's context", async () => {
    let seenPredictiveSignal: unknown;
    await runAgentTurn(
      baseState(),
      async (_action, context) => {
        seenPredictiveSignal = context.predictiveSignal;
        return { ok: true, actionId: "x", message: "ok" };
      },
      { predictiveSignal: { leadScore: 50, lifeEventLikelihood: 10 } },
    );

    assert.deepEqual(seenPredictiveSignal, { leadScore: 50, lifeEventLikelihood: 10 });
  });
});
