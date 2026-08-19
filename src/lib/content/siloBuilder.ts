import type { ContentSilo, Pattern } from "@/lib/agents/contentAgent";

/**
 * Classifies already-silo-tagged patterns (contentAgent.parseContent sets
 * Pattern.silo) into a recommended funnel type and landing-page section
 * order. Deterministic mapping — no external calls.
 */

export type FunnelType = "lead_magnet" | "life_event_outreach" | "tool_engagement" | "educational_nurture";

export interface SiloRecommendation {
  silo: ContentSilo;
  funnelType: FunnelType;
  landingPageSections: string[];
  reasoning: string;
}

const SILO_FUNNEL_MAP: Record<ContentSilo, { funnelType: FunnelType; sections: string[]; reasoning: string }> = {
  "Life Events": {
    funnelType: "life_event_outreach",
    sections: ["hero", "life_event_story", "how_we_help", "testimonials", "faq"],
    reasoning: "Life-event content converts on urgency and empathy — lead with the situation, then the specific help.",
  },
  "Predictive Intelligence": {
    funnelType: "educational_nurture",
    sections: ["hero", "features", "faq"],
    reasoning: "Predictive/AI content needs credibility-building before the ask — explain the mechanism first.",
  },
  Tools: {
    funnelType: "tool_engagement",
    sections: ["hero", "features", "faq"],
    reasoning: "Tool-driven content converts best by getting the visitor using the tool immediately.",
  },
  Guides: {
    funnelType: "lead_magnet",
    sections: ["hero", "features", "testimonials", "faq"],
    reasoning: "Guide content works as a lead magnet — trade the full guide for contact info.",
  },
};

export function recommendForPattern(pattern: Pattern): SiloRecommendation {
  const mapped = SILO_FUNNEL_MAP[pattern.silo];
  return {
    silo: pattern.silo,
    funnelType: mapped.funnelType,
    landingPageSections: mapped.sections,
    reasoning: mapped.reasoning,
  };
}

export function groupPatternsBySilo(patterns: Pattern[]): Record<ContentSilo, Pattern[]> {
  const groups: Record<ContentSilo, Pattern[]> = {
    "Life Events": [],
    "Predictive Intelligence": [],
    Tools: [],
    Guides: [],
  };
  for (const pattern of patterns) groups[pattern.silo].push(pattern);
  return groups;
}
