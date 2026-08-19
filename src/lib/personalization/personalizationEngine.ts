import type { CountyEvents, PredictiveResult, ZipContext } from "@/lib/agents/predictiveAgent";

/**
 * Turns ZipContext/CountyEvents/PredictiveResult into borrower-facing copy.
 * zipContext.ts and countyEvents.ts return neutral (zeroed) placeholders
 * until a live data provider is configured — every summary here checks for
 * a real signal first and falls back to an honest "we don't have that yet"
 * line rather than fabricating a stat, matching this app's no-fake-data
 * convention (see README's local SEO section).
 */

export interface PersonalizationInput {
  zipContext: ZipContext;
  countyEvents?: CountyEvents;
  predictive?: PredictiveResult;
}

export interface PersonalizationSummary {
  zipDemandSummary: string;
  lifeEventSummary: string;
  remodelRoiTeaser: string;
  rentalDemandTeaser: string;
  whyThisMattersForYou: string;
}

function hasRentalSignal(zipCtx: ZipContext): boolean {
  return zipCtx.rentalDemand.demandScore > 0 || zipCtx.rentalDemand.avgRent > 0;
}

function zipDemandSummary(zipCtx: ZipContext): string {
  if (!hasRentalSignal(zipCtx)) {
    return `We're still building out live market stats for ${zipCtx.zip} — your loan officer can walk you through the local picture directly.`;
  }
  const trendWord =
    zipCtx.rentalDemand.trend === "up" ? "climbing" : zipCtx.rentalDemand.trend === "down" ? "easing" : "holding steady";
  return `Rental demand in ${zipCtx.zip} is ${trendWord}, with vacancy around ${(zipCtx.rentalDemand.vacancyRate * 100).toFixed(1)}%.`;
}

function lifeEventSummary(countyEvents: CountyEvents | undefined, predictive: PredictiveResult | undefined): string {
  if (predictive && predictive.lifeEventLikelihood > 0) {
    const band = predictive.lifeEventLikelihood >= 55 ? "elevated" : predictive.lifeEventLikelihood >= 25 ? "moderate" : "light";
    return `Life-event signal for this area is ${band} (${Math.round(predictive.lifeEventLikelihood)}/100)${
      predictive.reasons[0] ? ` — ${predictive.reasons[0]}` : ""
    }`;
  }
  if (countyEvents && countyEvents.county !== "Unknown") {
    return `${countyEvents.county} County life-event data is on file, but nothing stands out yet for this lead.`;
  }
  return "We don't have county-level life-event data connected for this area yet.";
}

function remodelRoiTeaser(zipCtx: ZipContext): string {
  if (zipCtx.census.medianIncome > 0) {
    return `See how a remodel could move the needle on resale value for homes near ${zipCtx.zip}.`;
  }
  return "Curious what a remodel could add to your home's value? Ask your loan officer for a quick estimate.";
}

function rentalDemandTeaser(zipCtx: ZipContext): string {
  if (hasRentalSignal(zipCtx)) {
    return `Average rent near ${zipCtx.zip} is running about $${Math.round(zipCtx.rentalDemand.avgRent).toLocaleString()}/mo.`;
  }
  return "Want to know what rental demand looks like in your area? We can pull that up for you.";
}

function whyThisMattersForYou(zipCtx: ZipContext, predictive: PredictiveResult | undefined): string {
  if (predictive && predictive.leadScore >= 60) {
    return "Based on what we're seeing locally, this looks like a strong time to move — let's talk specifics.";
  }
  if (zipCtx.census.mobilityRate >= 0.2) {
    return "Households in this area are moving more than average — worth exploring your options now.";
  }
  return "Every ZIP is different — we'll walk you through exactly what applies to your situation.";
}

export function buildPersonalization(input: PersonalizationInput): PersonalizationSummary {
  return {
    zipDemandSummary: zipDemandSummary(input.zipContext),
    lifeEventSummary: lifeEventSummary(input.countyEvents, input.predictive),
    remodelRoiTeaser: remodelRoiTeaser(input.zipContext),
    rentalDemandTeaser: rentalDemandTeaser(input.zipContext),
    whyThisMattersForYou: whyThisMattersForYou(input.zipContext, input.predictive),
  };
}
