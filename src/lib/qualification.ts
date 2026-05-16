import type {
  BorrowerAnswers,
  LoanProgram,
  LeadQuality,
  ProgramScores,
  QualificationSummary,
  Urgency,
} from "./types";

function creditMidpointFromBand(band?: string): number {
  switch (band) {
    case "740-850":
      return 780;
    case "670-739":
      return 705;
    case "620-669":
      return 648;
    case "580-619":
      return 598;
    default:
      return 640;
  }
}

export function urgencyFromTimeline(timeline?: string): Urgency {
  switch (timeline) {
    case "lt_30":
      return "critical";
    case "1_3_months":
      return "high";
    case "3_6_months":
      return "standard";
    default:
      return "low";
  }
}

function leadQualityFromScore(score: number, urgency: Urgency): LeadQuality {
  let adjusted = score;
  if (urgency === "critical") adjusted += 5;
  if (urgency === "high") adjusted += 3;
  if (adjusted >= 86) return "prime";
  if (adjusted >= 72) return "strong";
  if (adjusted >= 58) return "developing";
  return "watch";
}

function employmentBonus(status?: string): number {
  if (status === "w2") return 6;
  if (status === "self") return 3;
  if (status === "investor") return 8;
  if (status === "retired") return 5;
  return 2;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function timingComposite(timeline?: string): number {
  switch (timeline) {
    case "lt_30":
      return 12;
    case "1_3_months":
      return 7;
    case "3_6_months":
      return 3;
    default:
      return 0;
  }
}

function normalizedFhaFit(answers: BorrowerAnswers): number {
  const credit = creditMidpointFromBand(answers.estimatedCreditBand);
  const base = Math.min((credit / 740) * 70, 70);
  const firstBoost =
    answers.firstTimeBuyer === true ? 8 : answers.firstTimeBuyer === false ? 4 : 0;
  const down = answers.estimatedDownPaymentUsd ?? 0;
  let downBoost = 0;
  const incomeRef = answers.annualIncomeUsd ?? 1;
  if (answers.purchaseRefiIntent === "purchase") {
    downBoost = Math.min(18, Math.log10(Math.max(down / (incomeRef * 0.05), 1)) * 10);
  } else if (answers.purchaseRefiIntent === "refinance") {
    downBoost = 12;
  } else {
    downBoost = 6;
  }
  return clampScore(base + firstBoost + downBoost + employmentBonus(answers.employment));
}

function vaFit(answers: BorrowerAnswers): number {
  if (answers.loanProgram === "VA") {
    let score = 66;
    if (answers.veteranStatus === "yes") score += 8;
    if (answers.veteranStatus === "unsure") score += 4;
    if (answers.vaCertificateOfEligibility === "yes") score += 16;
    if (answers.vaCertificateOfEligibility === "unsure") score += 6;
    score += clampScore((creditMidpointFromBand(answers.estimatedCreditBand) - 640) / 5);
    return clampScore(score);
  }
  if (answers.veteranStatus === "yes") return clampScore(58);
  return clampScore(32);
}

function investorFit(answers: BorrowerAnswers): number {
  const rent = answers.expectedMonthlyRentUsd ?? 0;
  const portfolioDepth = answers.portfolioPropertyCount ?? 1;
  const income = answers.annualIncomeUsd ?? 1;

  /** lightweight rent-to-income heuristic */
  const rentSignal = clampScore(Math.log10(Math.max(rent / (income / 260), 0.4)) * 42);
  const depthSignal = clampScore(portfolioDepth * 7 + 34);
  const creditCue = clampScore((creditMidpointFromBand(answers.estimatedCreditBand) - 600) / 2);

  return clampScore(rentSignal * 0.45 + depthSignal * 0.45 + creditCue * 0.1);
}

function refiFit(answers: BorrowerAnswers): number {
  const modeledRate = answers.currentRatePct ?? 6.35;
  const spread = Math.max(modeledRate - 6.1, 0);
  let score =
    clampScore(creditMidpointFromBand(answers.estimatedCreditBand) / 740 * 62) +
    clampScore(spread * 11) +
    employmentBonus(answers.employment) * 0.7;

  if ((answers.currentLoanBalanceUsd ?? 0) > 325_000) score += 3;
  if (answers.refinanceGoal === "cash_out") score += 5;
  if (answers.refinanceGoal === "remove_mi") score += 6;

  return clampScore(score);
}

function programWeighted(
  loan: LoanProgram,
  baseline: number,
  scores: Pick<
    ProgramScores,
    "fhaScore" | "vaEligibilityScore" | "investorProfileScore" | "refiOpportunityScore"
  >,
): number {
  const base = baseline || 62;
  switch (loan) {
    case "FHA":
      return clampScore((scores.fhaScore ?? base) * 0.91 + base * 0.09);
    case "VA":
      return clampScore((scores.vaEligibilityScore ?? base) * 0.93 + base * 0.07);
    case "DSCR":
      return clampScore((scores.investorProfileScore ?? base) * 0.9 + base * 0.1);
    case "REFI":
      return clampScore((scores.refiOpportunityScore ?? base) * 0.92 + base * 0.08);
    case "HELOC":
      return clampScore(
        (scores.refiOpportunityScore ?? base) * 0.52 + base * 0.48 + (scores.fhaScore ?? base) * 0.06,
      );
    case "JUMBO":
      return clampScore(base * 0.85 + (scores.fhaScore ?? base) * 0.15);
    default:
      return clampScore(base);
  }
}

function recommendNext(loan: LoanProgram, quality: LeadQuality, urgency: Urgency): string {
  const hot = urgency === "critical" || urgency === "high";
  switch (loan) {
    case "DSCR":
      return quality === "watch"
        ? "Route to portfolio strategist to validate rent comps, reserves, and entity docs."
        : "Push underwriting-ready DSCR dossier plus rent roll snapshots into LOS.";
    case "VA":
      return "Confirm COE + residual income scaffolding; IRRRL playbook if refinancing.";
    case "HELOC":
      return hot
        ? "Order valuation cascade + payoff demand; LOS warm transfer inside 45 minutes."
        : "Schedule valuation consult + lien positioning memo with lien specialist.";
    case "REFI":
      return "Model savings vs payoff breakeven; prioritize if removing MI or netting >75 bps.";
    case "JUMBO":
      return quality === "prime"
        ? "White-glove underwriting packet with asset seasoning proof + bespoke pricing."
        : "Elevate liquidity story + contingency reserves before LOS commit.";
    default:
      return hot
        ? "Fast LOS build with automated FHA disclosure vault + underwriting triage."
        : "Nurture with FHA roadmap content while documents trickle in.";
  }
}

export function recommendPrograms(answers: BorrowerAnswers): LoanProgram[] {
  const anchors: LoanProgram[] = [answers.loanProgram];
  if (answers.purchaseRefiIntent === "refinance" && !anchors.includes("REFI")) anchors.push("REFI");
  if (
    answers.employment === "investor" &&
    answers.portfolioPropertyCount &&
    answers.portfolioPropertyCount > 0 &&
    !anchors.includes("DSCR")
  ) {
    anchors.push("DSCR");
  }
  if (answers.veteranStatus === "yes" && !anchors.includes("VA")) anchors.unshift("VA");
  return anchors;
}

export function buildQualification(answers: BorrowerAnswers): QualificationSummary {
  const rationale: string[] = [];

  const fhaScore = normalizedFhaFit(answers);
  rationale.push(`FHA proxy score ${Math.round(fhaScore)}.`);

  const vaEligibilityScore = vaFit(answers);
  rationale.push(`VA eligibility signal ${Math.round(vaEligibilityScore)}.`);

  const investorProfileScore = investorFit(answers);
  rationale.push(`Investor suitability ${Math.round(investorProfileScore)}.`);

  const refiOpportunityScore = refiFit(answers);
  rationale.push(`Refinance opportunity pulse ${Math.round(refiOpportunityScore)}.`);

  const urgency = urgencyFromTimeline(answers.timeline);

  /** Broad composite baseline */
  const compositeBaseline = clampScore(
    fhaScore * 0.26 +
      vaEligibilityScore * 0.18 +
      investorProfileScore * 0.2 +
      refiOpportunityScore * 0.26 +
      timingComposite(answers.timeline) +
      (answers.purchaseRefiIntent === "refinance" ? 3 : 0),
  );

  const weighted = programWeighted(answers.loanProgram, compositeBaseline, {
    fhaScore,
    vaEligibilityScore,
    investorProfileScore,
    refiOpportunityScore,
  });

  const scores: ProgramScores = {
    fhaScore,
    vaEligibilityScore,
    investorProfileScore,
    refiOpportunityScore,
    overallScore: weighted,
  };

  rationale.push(`Weighted LOS composite ${Math.round(scores.overallScore ?? 0)}.`);

  if (answers.loanProgram === "HELOC") {
    const numerator = answers.currentMortgageBalanceUsd ?? 0;
    const denominator = Math.max(answers.estimatedHomeValueUsd ?? 1, 1);
    const impliedLtv = Math.round((numerator / denominator) * 100);
    rationale.push(`Implied first-lien LTV ${impliedLtv}%.`);
  }

  const leadQuality = leadQualityFromScore(scores.overallScore, urgency);
  const recommendedNextStep = recommendNext(answers.loanProgram, leadQuality, urgency);

  return {
    programScores: scores,
    leadQuality,
    urgency,
    recommendedNextStep,
    rationale,
  };
}
