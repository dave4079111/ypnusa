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

function answersFor(program: LoanProgram, extra: Partial<BorrowerAnswers> = {}): BorrowerAnswers {
  return { loanProgram: program, ...extra };
}

describe("intake flow composition", () => {
  it("puts the program preface ahead of the shared base and identity steps", () => {
    const va = composeFlow("VA");

    assert.deepEqual(
      va.slice(0, 2).map((step) => step.id),
      ["va_eligibility", "va_coe"],
    );
    assert.equal(va[2]?.id, "borrower_goal");
    assert.deepEqual(
      va.slice(-4).map((step) => step.id),
      ["borrower_full_name", "borrower_email", "borrower_phone", "contact_consent"],
    );
  });

  it("keeps every program flow uniquely identified and consistently typed", () => {
    for (const program of ALL_PROGRAMS) {
      const flow = composeFlow(program);
      const ids = flow.map((step) => step.id);

      assert.equal(new Set(ids).size, ids.length, `${program} has duplicate step ids`);
      assert.equal(flow.length, programPrefaces[program].length + 11);

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
  it("counts the down-payment step only for purchase borrowers", () => {
    const purchase = estimateTotalSteps(
      "CONVENTIONAL",
      answersFor("CONVENTIONAL", { purchaseRefiIntent: "purchase" }),
    );
    const refinance = estimateTotalSteps(
      "CONVENTIONAL",
      answersFor("CONVENTIONAL", { purchaseRefiIntent: "refinance" }),
    );

    assert.equal(purchase, 11);
    assert.equal(refinance, 10);
  });

  it("asks for the program preface first, then walks the remaining gaps", () => {
    const answers = answersFor("FHA");

    assert.equal(findNextStep("FHA", answers)?.id, "fha_first_home");
    assert.equal(findNextStep("FHA", { ...answers, firstTimeBuyer: false })?.id, "borrower_goal");
  });

  it("skips the conditional down-payment step for refinance borrowers", () => {
    const refinance = answersFor("CONVENTIONAL", {
      purchaseRefiIntent: "refinance",
      propertyType: "single_family",
      estimatedCreditBand: "670-739",
      employment: "w2",
      annualIncomeUsd: 120_000,
      timeline: "1_3_months",
    });

    assert.equal(findNextStep("CONVENTIONAL", refinance)?.id, "borrower_full_name");
    assert.equal(
      findNextStep("CONVENTIONAL", { ...refinance, purchaseRefiIntent: "purchase" })?.id,
      "estimated_down_payment",
    );
  });

  it("returns null and 100% once every applicable step is answered", () => {
    const complete = answersFor("CONVENTIONAL", {
      purchaseRefiIntent: "refinance",
      propertyType: "single_family",
      estimatedCreditBand: "740-850",
      employment: "w2",
      annualIncomeUsd: 180_000,
      timeline: "lt_30",
      name: "Taylor Borrower",
      email: "taylor@example.com",
      phone: "+15555550123",
      contactConsent: false,
    });

    assert.equal(findNextStep("CONVENTIONAL", complete), null);
    assert.deepEqual(summarizeFlowProgress("CONVENTIONAL", complete), {
      pct: 100,
      completed: 10,
      totalApplicable: 10,
    });
  });

  it("reports rounded partial progress against applicable steps only", () => {
    assert.deepEqual(
      summarizeFlowProgress("CONVENTIONAL", answersFor("CONVENTIONAL")),
      { pct: 0, completed: 0, totalApplicable: 10 },
    );
    assert.deepEqual(
      summarizeFlowProgress(
        "CONVENTIONAL",
        answersFor("CONVENTIONAL", { purchaseRefiIntent: "refinance", propertyType: "attached" }),
      ),
      { pct: 20, completed: 2, totalApplicable: 10 },
    );
  });
});

describe("greetingForProgram", () => {
  it("names the requested program in a distinct greeting for every program", () => {
    const greetings = ALL_PROGRAMS.map((program) => {
      const greeting = greetingForProgram(program);
      assert.match(greeting, new RegExp(`YPN USA ${program} intake assistant`));
      return greeting;
    });

    assert.equal(new Set(greetings).size, ALL_PROGRAMS.length);
  });
});
