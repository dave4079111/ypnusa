import assert from "node:assert/strict";
import test from "node:test";
import { decideNextAction } from "./next-best-action";
import type { AgentContext } from "./agent-types";

function context(overrides: Partial<AgentContext["state"]>): AgentContext {
  return {
    state: {
      lifecycle: "engaged",
      answers: { loanProgram: "FHA" },
      recentFollowUps: [],
      currentObjective: "qualify borrower",
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

test("uses the deterministic intake flow as the first decision rail", () => {
  const action = decideNextAction(context({}));
  assert.equal(action.kind, "ask_question");
  assert.equal(action.payload.field, "purchaseRefiIntent");
});

test("routes a qualified lead", () => {
  const action = decideNextAction(
    context({
      lifecycle: "qualified",
      qualification: {
        programScores: { overallScore: 80 },
        leadQuality: "strong",
        urgency: "high",
        recommendedNextStep: "Route to an MLO",
        rationale: [],
      },
    }),
  );

  assert.equal(action.kind, "route_lead");
});

test("waits when no autonomous action is justified", () => {
  const action = decideNextAction(context({ lifecycle: "closed" }));
  assert.equal(action.kind, "wait");
});

test("escalates a contacting lead to alert_mlo when the predictive outcome signal is high", () => {
  const action = decideNextAction({
    ...context({ lifecycle: "contacting" }),
    predictiveSignal: {
      leadScore: 40,
      lifeEventLikelihood: 55,
      outcomeSignals: {
        signupLikelihood: 30,
        insightRequestLikelihood: 30,
        conversionLikelihood: 30,
        followUpNecessity: 80,
        rationale: "test",
      },
    },
  });

  assert.equal(action.kind, "alert_mlo");
  assert.match(action.reason, /predictive/i);
});

test("does not escalate a contacting lead when the predictive outcome signal is below threshold", () => {
  const action = decideNextAction({
    ...context({ lifecycle: "contacting" }),
    predictiveSignal: {
      leadScore: 40,
      lifeEventLikelihood: 10,
      outcomeSignals: {
        signupLikelihood: 30,
        insightRequestLikelihood: 30,
        conversionLikelihood: 30,
        followUpNecessity: 58,
        rationale: "test",
      },
    },
  });

  assert.equal(action.kind, "create_followup");
});
