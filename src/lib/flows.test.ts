import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeFlow,
  estimateTotalSteps,
  findNextStep,
  greetingForProgram,
  isUnset,
  programPrefaces,
  summarizeFlowProgress,
} from "./flows";
import type { BorrowerAnswers, LoanProgram } from "./types";

const ALL_PROGRAMS: LoanProgram[] = [
  "FHA",
  "VA",
  "CONVENTIONAL",
  "DSCR",
  "HELOC",
  "REFI",
  "JUMBO",
];

const STEP_IDS = [
  "borrower_goal",
  "target_amount",
  "timeline",
  "credit_band",
  "borrower_full_name",
  "borrower_phone",
  "borrower_email",
  "contact_consent",
];

function answersFor(program: LoanProgram, extra: Partial<BorrowerAnswers> = {}): BorrowerAnswers {
  return { loanProgram: program, ...extra };
}

describe("intake flow composition", () => {
  it("returns the same short conversational flow for every program", () => {
    for (const program of ALL_PROGRAMS) {
      const flow = composeFlow(program);
      assert.deepEqual(flow.map((step) => step.id), STEP_IDS);
    }
  });

  it("leaves program prefaces empty now that deeper qualification is deferred", () => {
    for (const program of ALL_PROGRAMS) {
      assert.deepEqual(programPrefaces[program], []);
    }
  });

  it("keeps every program flow uniquely identified and consistently typed", () => {
    for (const program of ALL_PROGRAMS) {
      const flow = composeFlow(program);
      const ids = flow.map((step) => step.id);

      assert.equal(new Set(ids).size, ids.length, `${program} has duplicate step ids`);
      assert.equal(flow.length, STEP_IDS.length);

      for (const step of flow) {
        assert.ok(step.prompt.length > 0, `${program}/${step.id} is missing a prompt`);
        if (step.kind === "select" || step.kind === "boolean") {
          assert.ok((step.chips?.length ?? 0) > 0, `${program}/${step.id} needs quick replies`);
        }
      }
    }
  });

  it("returns an independent array so callers cannot mutate the shared flow", () => {
    const first = composeFlow("FHA");
    first.pop();

    assert.equal(composeFlow("FHA").length, first.length + 1);
  });
});

describe("isUnset", () => {
  it("treats missing values and whitespace-only strings as unanswered", () => {
    assert.equal(isUnset(undefined), true);
    assert.equal(isUnset(null), true);
    assert.equal(isUnset(""), true);
    assert.equal(isUnset("   "), true);
  });

  it("treats falsy-but-answered values as answered", () => {
    assert.equal(isUnset(false), false);
    assert.equal(isUnset(0), false);
    assert.equal(isUnset("no"), false);
  });
});

describe("flow progress and next-step resolution", () => {
  it("has no conditional steps, so the total is constant across intents", () => {
    const purchase = estimateTotalSteps(
      "CONVENTIONAL",
      answersFor("CONVENTIONAL", { purchaseRefiIntent: "purchase" }),
    );
    const refinance = estimateTotalSteps(
      "CONVENTIONAL",
      answersFor("CONVENTIONAL", { purchaseRefiIntent: "refinance" }),
    );

    assert.equal(purchase, STEP_IDS.length);
    assert.equal(refinance, STEP_IDS.length);
  });

  it("walks the flow in order starting from the borrower's goal", () => {
    const answers = answersFor("FHA");

    assert.equal(findNextStep("FHA", answers)?.id, "borrower_goal");
    assert.equal(
      findNextStep("FHA", { ...answers, purchaseRefiIntent: "purchase" })?.id,
      "target_amount",
    );
  });

  it("returns null and 100% once every step is answered", () => {
    const complete = answersFor("CONVENTIONAL", {
      purchaseRefiIntent: "refinance",
      targetLoanAmountUsd: 400_000,
      timeline: "lt_30",
      estimatedCreditBand: "740-850",
      name: "Taylor Borrower",
      phone: "+15555550123",
      email: "taylor@example.com",
      contactConsent: false,
    });

    assert.equal(findNextStep("CONVENTIONAL", complete), null);
    assert.deepEqual(summarizeFlowProgress("CONVENTIONAL", complete), {
      pct: 100,
      completed: STEP_IDS.length,
      totalApplicable: STEP_IDS.length,
    });
  });

  it("reports rounded partial progress across the shared steps", () => {
    assert.deepEqual(summarizeFlowProgress("CONVENTIONAL", answersFor("CONVENTIONAL")), {
      pct: 0,
      completed: 0,
      totalApplicable: STEP_IDS.length,
    });
    assert.deepEqual(
      summarizeFlowProgress(
        "CONVENTIONAL",
        answersFor("CONVENTIONAL", { purchaseRefiIntent: "refinance", targetLoanAmountUsd: 400_000 }),
      ),
      { pct: 25, completed: 2, totalApplicable: STEP_IDS.length },
    );
  });
});

describe("greetingForProgram", () => {
  it("returns the same generic greeting regardless of program", () => {
    const greetings = ALL_PROGRAMS.map((program) => greetingForProgram(program));

    for (const greeting of greetings) {
      assert.match(greeting, /YPN USA intake assistant/);
    }
    assert.equal(new Set(greetings).size, 1);
  });
});
