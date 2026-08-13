import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQualification, recommendPrograms, urgencyFromTimeline } from "./qualification";
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

describe("urgencyFromTimeline", () => {
  it("maps each timeline chip to an urgency band and defaults to low", () => {
    assert.equal(urgencyFromTimeline("lt_30"), "critical");
    assert.equal(urgencyFromTimeline("1_3_months"), "high");
    assert.equal(urgencyFromTimeline("3_6_months"), "standard");
    assert.equal(urgencyFromTimeline("researching"), "low");
    assert.equal(urgencyFromTimeline(undefined), "low");
  });
});

describe("recommendPrograms", () => {
  it("keeps the requested program as the anchor", () => {
    assert.deepEqual(recommendPrograms({ loanProgram: "REFI", purchaseRefiIntent: "refinance" }), [
      "REFI",
    ]);
  });

  it("adds REFI and DSCR anchors and promotes VA eligibility to the front", () => {
    assert.deepEqual(
      recommendPrograms({
        loanProgram: "CONVENTIONAL",
        purchaseRefiIntent: "refinance",
        employment: "investor",
        portfolioPropertyCount: 3,
        veteranStatus: "yes",
      }),
      ["VA", "CONVENTIONAL", "REFI", "DSCR"],
    );
  });

  it("ignores an investor with no financed properties", () => {
    assert.deepEqual(
      recommendPrograms({ loanProgram: "DSCR", employment: "investor", portfolioPropertyCount: 0 }),
      ["DSCR"],
    );
  });
});

describe("buildQualification scoring", () => {
  it("scores a documented, rate-motivated refinance as a critical prime lead", () => {
    const summary = buildQualification({
      loanProgram: "REFI",
      estimatedCreditBand: "740-850",
      employment: "w2",
      annualIncomeUsd: 250_000,
      timeline: "lt_30",
      purchaseRefiIntent: "refinance",
      currentRatePct: 7.5,
      currentLoanBalanceUsd: 400_000,
      refinanceGoal: "remove_mi",
    });

    assert.equal(summary.leadQuality, "prime");
    assert.equal(summary.urgency, "critical");
    assert.ok((summary.programScores.overallScore ?? 0) > 90);
    assert.match(summary.recommendedNextStep, /breakeven/);
    assert.deepEqual(summary.rationale, [
      "FHA proxy score 88.",
      "VA eligibility signal 32.",
      "Investor suitability 27.",
      "Refinance opportunity pulse 94.",
      "Weighted LOS composite 92.",
    ]);
  });

  it("scores a thin, research-mode jumbo file as a low-urgency watch lead", () => {
    const summary = buildQualification({
      loanProgram: "JUMBO",
      estimatedCreditBand: "580-619",
      timeline: "researching",
    });

    assert.equal(summary.leadQuality, "watch");
    assert.equal(summary.urgency, "low");
    assert.ok((summary.programScores.overallScore ?? 0) < 58);
    assert.match(summary.recommendedNextStep, /liquidity story/);
  });

  it("gives a VA borrower with a ready COE the full eligibility signal", () => {
    const eligible = buildQualification({
      loanProgram: "VA",
      veteranStatus: "yes",
      vaCertificateOfEligibility: "yes",
      estimatedCreditBand: "740-850",
      timeline: "lt_30",
    });
    const undocumented = buildQualification({
      loanProgram: "VA",
      veteranStatus: "no",
      vaCertificateOfEligibility: "no",
      estimatedCreditBand: "740-850",
      timeline: "lt_30",
    });

    assert.equal(eligible.programScores.vaEligibilityScore, 100);
    assert.ok(
      (undocumented.programScores.vaEligibilityScore ?? 0) <
        (eligible.programScores.vaEligibilityScore ?? 0),
    );
    assert.match(eligible.recommendedNextStep, /COE/);
  });

  it("only reports VA-adjacent interest for non-VA programs", () => {
    const civilian = buildQualification({ loanProgram: "CONVENTIONAL" });
    const veteran = buildQualification({ loanProgram: "CONVENTIONAL", veteranStatus: "yes" });

    assert.equal(civilian.programScores.vaEligibilityScore, 32);
    assert.equal(veteran.programScores.vaEligibilityScore, 58);
  });

  it("appends the implied first-lien LTV for HELOC borrowers only", () => {
    const heloc = buildQualification({
      loanProgram: "HELOC",
      estimatedHomeValueUsd: 600_000,
      currentMortgageBalanceUsd: 300_000,
      estimatedCreditBand: "670-739",
      timeline: "3_6_months",
    });
    const conventional = buildQualification({
      loanProgram: "CONVENTIONAL",
      estimatedHomeValueUsd: 600_000,
      currentMortgageBalanceUsd: 300_000,
    });

    assert.equal(heloc.rationale.at(-1), "Implied first-lien LTV 50%.");
    assert.equal(heloc.urgency, "standard");
    assert.ok(!conventional.rationale.some((line) => line.includes("LTV")));
  });

  it("does not divide by zero when HELOC property value is missing", () => {
    const summary = buildQualification({
      loanProgram: "HELOC",
      currentMortgageBalanceUsd: 250_000,
    });

    assert.equal(summary.rationale.at(-1), "Implied first-lien LTV 25000000%.");
    assert.ok(Number.isFinite(summary.programScores.overallScore ?? NaN));
  });

  it("rewards portfolio depth and rent coverage for DSCR investors", () => {
    const shallow = buildQualification({
      loanProgram: "DSCR",
      employment: "investor",
      portfolioPropertyCount: 1,
      expectedMonthlyRentUsd: 900,
      annualIncomeUsd: 180_000,
      estimatedCreditBand: "740-850",
      timeline: "1_3_months",
    });
    const deep = buildQualification({
      loanProgram: "DSCR",
      employment: "investor",
      portfolioPropertyCount: 6,
      expectedMonthlyRentUsd: 4_200,
      annualIncomeUsd: 180_000,
      estimatedCreditBand: "740-850",
      timeline: "1_3_months",
    });

    assert.ok(
      (deep.programScores.investorProfileScore ?? 0) >
        (shallow.programScores.investorProfileScore ?? 0),
    );
    assert.ok((deep.programScores.overallScore ?? 0) > (shallow.programScores.overallScore ?? 0));
  });

  it("varies the recommended next step with urgency for the same file", () => {
    const answers: BorrowerAnswers = {
      loanProgram: "FHA",
      estimatedCreditBand: "620-669",
      firstTimeBuyer: true,
      purchaseRefiIntent: "purchase",
      estimatedDownPaymentUsd: 12_000,
      annualIncomeUsd: 90_000,
      employment: "w2",
    };

    const hot = buildQualification({ ...answers, timeline: "lt_30" });
    const cold = buildQualification({ ...answers, timeline: "researching" });

    assert.equal(hot.urgency, "critical");
    assert.match(hot.recommendedNextStep, /Fast LOS build/);
    assert.equal(cold.urgency, "low");
    assert.match(cold.recommendedNextStep, /Nurture/);
    assert.ok((hot.programScores.overallScore ?? 0) > (cold.programScores.overallScore ?? 0));
  });

  it("keeps every program's scores clamped, rationalized, and routable", () => {
    for (const loanProgram of ALL_PROGRAMS) {
      const summary = buildQualification({ loanProgram });
      const scores = Object.values(summary.programScores);

      assert.ok(scores.length > 0);
      for (const score of scores) {
        assert.ok(
          typeof score === "number" && score >= 0 && score <= 100,
          `${loanProgram} produced an out-of-range score: ${String(score)}`,
        );
      }
      assert.ok(summary.recommendedNextStep.length > 0);
      assert.ok(summary.rationale.length >= 5);
      assert.ok(["prime", "strong", "developing", "watch"].includes(summary.leadQuality));
    }
  });
});
