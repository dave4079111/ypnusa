import type { Pattern } from "@/lib/agents/contentAgent";
import type { FunnelOutput } from "@/lib/content/funnelBuilder";
import type { PersonalizationSummary } from "@/lib/personalization/personalizationEngine";

/**
 * Composes ZIP/territory state, an optional content Pattern, an optional
 * FunnelOutput, and optional personalization into one CTA set. Pure/
 * synchronous — no I/O — so it can run client-side or server-side.
 */

export interface CtaContext {
  zip?: string;
  county?: string;
  available?: boolean;
  demandTotal?: number;
  pattern?: Pattern;
  funnel?: FunnelOutput;
  personalization?: PersonalizationSummary;
}

export interface CtaEntry {
  label: string;
  href?: string;
}

export interface CtaSet {
  primary: CtaEntry;
  secondary: CtaEntry;
  microNudges: string[];
  socialShare: CtaEntry;
  dashboard: CtaEntry;
}

function primaryCta(context: CtaContext): CtaEntry {
  const funnelCta = context.funnel?.ctaBlocks[0];
  if (funnelCta) return { label: funnelCta.label, href: funnelCta.url };
  if (context.available === false) return { label: "Join the waitlist" };
  if (context.zip) return { label: `Lock ZIP ${context.zip}` };
  return { label: "Get your free borrower profile" };
}

function secondaryCta(context: CtaContext): CtaEntry {
  if (context.personalization?.rentalDemandTeaser) return { label: "See your rental demand score" };
  return { label: "Unlock your remodel ROI report" };
}

function microNudges(context: CtaContext): string[] {
  const nudges: string[] = [];
  if (typeof context.demandTotal === "number" && context.demandTotal > 0) {
    nudges.push(`~${context.demandTotal} buyers/sellers/movers active in this ZIP over the last 60 days.`);
  }
  if (context.pattern?.offers[0]) nudges.push(context.pattern.offers[0]);
  if (context.personalization?.whyThisMattersForYou) nudges.push(context.personalization.whyThisMattersForYou);
  nudges.push("Almost there — questions are normal, ask us anything.");
  return nudges;
}

function socialShareCta(context: CtaContext): CtaEntry {
  const post = context.funnel?.socialPosts[0];
  if (post) return { label: `Share: ${post.headline}` };
  return { label: "Share your borrower page" };
}

function dashboardCta(): CtaEntry {
  return { label: "Go to your dashboard", href: "/dashboard" };
}

export function buildCtaSet(context: CtaContext): CtaSet {
  return {
    primary: primaryCta(context),
    secondary: secondaryCta(context),
    microNudges: microNudges(context),
    socialShare: socialShareCta(context),
    dashboard: dashboardCta(),
  };
}
