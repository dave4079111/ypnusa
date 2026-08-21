import type { CountyEvents, PredictiveResult, ZipContext } from "@/lib/agents/predictiveAgent";
import type { BorrowerProfile } from "@/lib/borrower/profileEngine";

/**
 * Turns ZipContext/CountyEvents/PredictiveResult (plus optional
 * BorrowerProfile / funnel stage) into outcome-likelihood predictions.
 * Pure/synchronous — no I/O.
 */

export type FunnelStageName =
  | "viewed_borrower_page"
  | "clicked_cta"
  | "started_signup"
  | "completed_signup"
  | "viewed_dashboard"
  | "requested_insights";

export interface OutcomeSignalsInput {
  zipContext: ZipContext;
  countyEvents: CountyEvents;
  predictive: PredictiveResult;
  borrowerProfile?: BorrowerProfile;
  funnelStage?: FunnelStageName;
}

export interface OutcomeSignals {
  signupLikelihood: number;
  insightRequestLikelihood: number;
  conversionLikelihood: number;
  followUpNecessity: number;
  rationale: string;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

const STAGE_PROGRESS: Record<FunnelStageName, number> = {
  viewed_borrower_page: 10,
  clicked_cta: 25,
  started_signup: 45,
  completed_signup: 70,
  viewed_dashboard: 80,
  requested_insights: 90,
};

export function buildOutcomeSignals(input: OutcomeSignalsInput): OutcomeSignals {
  const stageProgress = input.funnelStage ? STAGE_PROGRESS[input.funnelStage] : 0;
  const leadScore = clampScore(input.predictive.leadScore);
  const lifeEventLikelihood = clampScore(input.predictive.lifeEventLikelihood);
  const confidence = input.borrowerProfile?.confidenceScore ?? leadScore;

  const signupLikelihood = clampScore(leadScore * 0.4 + confidence * 0.3 + stageProgress * 0.3);
  const insightRequestLikelihood = clampScore(lifeEventLikelihood * 0.5 + stageProgress * 0.5);
  const conversionLikelihood = clampScore(signupLikelihood * 0.6 + lifeEventLikelihood * 0.4);
  const followUpNecessity = clampScore(
    100 - stageProgress * 0.6 + (lifeEventLikelihood >= 40 ? 15 : 0) - (leadScore >= 70 ? 10 : 0),
  );

  const rationaleParts: string[] = [`Lead score ${Math.round(leadScore)}/100.`];
  if (input.funnelStage) rationaleParts.push(`Currently at "${input.funnelStage.replace(/_/g, " ")}".`);
  if (lifeEventLikelihood >= 25) rationaleParts.push(`Life-event likelihood ${Math.round(lifeEventLikelihood)}/100.`);

  return {
    signupLikelihood,
    insightRequestLikelihood,
    conversionLikelihood,
    followUpNecessity,
    rationale: rationaleParts.join(" "),
  };
}
