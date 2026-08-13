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
  assert.equal(action.payload.field, "firstTimeBuyer");
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
