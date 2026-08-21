import { appendAnalytics, readDb } from "@/lib/db";

/**
 * Pre-lead funnel stage tracking — upstream of BorrowerLeadRecord (an
 * anonymous visitor hasn't necessarily started intake yet). Persists through
 * the existing appendAnalytics()/db.analyticsEvents mechanism using the two
 * new AnalyticsEventRecord types (see types.ts) — no parallel storage layer.
 */

export type FunnelStage =
  | "viewed_borrower_page"
  | "clicked_cta"
  | "started_signup"
  | "completed_signup"
  | "viewed_dashboard"
  | "requested_insights";

const STAGE_ORDER: FunnelStage[] = [
  "viewed_borrower_page",
  "clicked_cta",
  "started_signup",
  "completed_signup",
  "viewed_dashboard",
  "requested_insights",
];

export interface StageTrackingResult {
  stage: FunnelStage;
  recommendedAction: string;
  recommendedOutreach: string;
}

const STAGE_COPY: Record<FunnelStage, { action: string; outreach: string }> = {
  viewed_borrower_page: {
    action: "Wait for a CTA click before reaching out — the borrower is still browsing.",
    outreach: "No outreach yet — let the page do the work.",
  },
  clicked_cta: {
    action: "Send a light-touch follow-up within the hour while intent is warm.",
    outreach: "Saw you're exploring your options — happy to answer questions, no pressure.",
  },
  started_signup: {
    action: "Nudge to finish — most drop-off happens mid-form.",
    outreach: "Almost there — questions are normal. Reply here if anything's unclear.",
  },
  completed_signup: {
    action: "Send the onboarding welcome sequence.",
    outreach: "Your borrower page is live — here's what happens next.",
  },
  viewed_dashboard: {
    action: "Surface a quick win (a report or insight) to build habit.",
    outreach: "Your rental demand score is ready — take a look.",
  },
  requested_insights: {
    action: "Deliver the requested report and offer a live walkthrough.",
    outreach: "Your local insights are updated — want to walk through them together?",
  },
};

export function recordStageEvent(id: string, stage: FunnelStage): void {
  appendAnalytics({ type: "funnel_stage_viewed", payload: { id, stage } });
}

export function recordCtaClick(id: string, ctaLabel: string): void {
  appendAnalytics({ type: "funnel_cta_clicked", payload: { id, ctaLabel } });
}

/** Furthest stage reached (by STAGE_ORDER position), or null if none recorded. */
export function currentStageFor(id: string): FunnelStage | null {
  const db = readDb();
  let furthestIndex = -1;
  let furthest: FunnelStage | null = null;

  for (const event of db.analyticsEvents) {
    if (event.type !== "funnel_stage_viewed") continue;
    if (event.payload.id !== id) continue;
    const stage = event.payload.stage;
    if (typeof stage !== "string") continue;
    const index = STAGE_ORDER.indexOf(stage as FunnelStage);
    if (index > furthestIndex) {
      furthestIndex = index;
      furthest = stage as FunnelStage;
    }
  }
  return furthest;
}

export function trackStage(id: string, stage: FunnelStage): StageTrackingResult {
  recordStageEvent(id, stage);
  const copy = STAGE_COPY[stage];
  return { stage, recommendedAction: copy.action, recommendedOutreach: copy.outreach };
}
