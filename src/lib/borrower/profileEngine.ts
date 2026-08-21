import type { CountyEvents, PredictiveResult, ZipContext } from "@/lib/agents/predictiveAgent";

/**
 * Combines borrower-stated intent with ZIP/county context and (optionally)
 * predictive scoring into a persona summary. Pure/synchronous — sits
 * alongside predictiveAgent.ts as a ZIP/county-context consumer; does not
 * feed or replace qualification.ts's intake-answer scoring.
 */

export interface BorrowerProfileBasics {
  zip: string;
  goal: string;
  timeline: string;
  propertyType?: string;
  creditConfidence?: "excellent" | "good" | "fair" | "building" | "unsure";
  incomeRange?: string;
}

export interface BorrowerProfileInput {
  borrower: BorrowerProfileBasics;
  zipContext: ZipContext;
  countyEvents: CountyEvents;
  predictive?: PredictiveResult;
}

export interface BorrowerProfile {
  persona: string;
  intentSummary: string;
  confidenceScore: number;
  timelinePrediction: string;
  whyThisMattersForYou: string;
  ctaRecommendations: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function describeTimeline(timeline: string): string {
  switch (timeline) {
    case "lt_30":
      return "under-30-day";
    case "1_3_months":
      return "1-3 month";
    case "3_6_months":
      return "3-6 month";
    default:
      return "flexible";
  }
}

function personaFor(input: BorrowerProfileInput): string {
  const goal = input.borrower.goal.trim().toLowerCase();
  if (goal.includes("refi")) return "Refinance-focused homeowner";
  if (input.predictive && input.predictive.lifeEventLikelihood >= 40) return "Life-event-driven mover";
  if (input.borrower.timeline === "lt_30") return "Fast-mover, ready within 30 days";
  if (goal.includes("invest") || goal.includes("rental")) return "Investor-minded buyer";
  return "Early-stage explorer";
}

function intentSummaryFor(input: BorrowerProfileInput): string {
  const property = input.borrower.propertyType ? ` for a ${input.borrower.propertyType}` : "";
  return `Looking to ${input.borrower.goal.trim().toLowerCase()}${property} near ${input.borrower.zip}, on a ${describeTimeline(
    input.borrower.timeline,
  )} timeline.`;
}

function confidenceScoreFor(input: BorrowerProfileInput): number {
  let score = 40;
  if (input.borrower.creditConfidence === "excellent") score += 25;
  else if (input.borrower.creditConfidence === "good") score += 15;
  else if (input.borrower.creditConfidence === "fair") score += 5;
  else if (input.borrower.creditConfidence === "building") score -= 10;

  if (input.borrower.timeline === "lt_30") score += 15;
  else if (input.borrower.timeline === "1_3_months") score += 8;

  if (input.predictive) score += clampScore(input.predictive.leadScore) * 0.2;

  return clampScore(score);
}

function timelinePredictionFor(timeline: string): string {
  if (timeline === "lt_30") return "Likely to move within the next 30 days.";
  if (timeline === "1_3_months") return "On track for a 1-3 month decision window.";
  if (timeline === "3_6_months") return "Building toward a 3-6 month decision window.";
  return "Timeline is still forming — keep the door open with light-touch check-ins.";
}

function whyThisMattersFor(input: BorrowerProfileInput): string {
  if (input.predictive && input.predictive.lifeEventLikelihood >= 40) {
    return "Local life-event signals suggest timing matters here — a quick conversation now can save weeks later.";
  }
  if (input.zipContext.census.mobilityRate >= 0.2) {
    return `Households in ${input.borrower.zip} are moving more than average — worth acting while options are open.`;
  }
  return "Every borrower's situation is different — this profile keeps the conversation focused on what actually applies.";
}

function ctaRecommendationsFor(input: BorrowerProfileInput, confidenceScore: number): string[] {
  const ctas: string[] = [];
  ctas.push(confidenceScore >= 65 ? `Lock ZIP ${input.borrower.zip}.` : "Get your free borrower profile.");
  if (input.predictive && input.predictive.lifeEventLikelihood >= 25) {
    ctas.push("See your local life-event insights.");
  }
  ctas.push("Unlock your remodel ROI report.");
  return ctas;
}

export function buildBorrowerProfile(input: BorrowerProfileInput): BorrowerProfile {
  const confidenceScore = confidenceScoreFor(input);
  return {
    persona: personaFor(input),
    intentSummary: intentSummaryFor(input),
    confidenceScore,
    timelinePrediction: timelinePredictionFor(input.borrower.timeline),
    whyThisMattersForYou: whyThisMattersFor(input),
    ctaRecommendations: ctaRecommendationsFor(input, confidenceScore),
  };
}
