/**
 * Rule-based, ML-ready lead scoring: combines rental-demand and census
 * context for the lead's ZIP with county-level life-event signals
 * (divorce/marriage/death/probate/migration). Deterministic today —
 * scoreLead's signature is stable so a real model can replace the
 * internals later without touching callers.
 */

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  zip: string;
  tags: string[];
  lastContactAt?: string;
  createdAt: string;
}

export interface ZipContext {
  zip: string;
  county: string;
  census: {
    medianIncome: number;
    renterShare: number;
    ownerShare: number;
    medianAge: number;
    mobilityRate: number;
  };
  rentalDemand: {
    demandScore: number;
    vacancyRate: number;
    avgRent: number;
    trend: "up" | "flat" | "down";
  };
}

export interface CountyEvents {
  county: string;
  divorcesPerCapita: number;
  marriagesPerCapita: number;
  deathsPerCapita: number;
  probateFilings: number;
  newBirths: number;
  migrationIn: number;
  migrationOut: number;
}

export interface PredictiveResult {
  leadScore: number;
  lifeEventLikelihood: number;
  recommendedAction: string;
  reasons: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

/** census shares/rates arrive as fractions (0-1), e.g. 0.42 = 42%. */
function rentalMarketSignal(zipCtx: ZipContext, tags: string[], reasons: string[]): number {
  const { demandScore, vacancyRate, trend } = zipCtx.rentalDemand;
  let score = clampScore(demandScore) * 0.5;

  if (vacancyRate <= 0.05) {
    score += 15;
    reasons.push(`Tight rental market in ${zipCtx.zip} (vacancy ${(vacancyRate * 100).toFixed(1)}%).`);
  } else if (vacancyRate >= 0.12) {
    score -= 8;
  }

  if (trend === "up") {
    score += 12;
    reasons.push("Rental demand is trending up.");
  } else if (trend === "down") {
    score -= 8;
  }

  if (tags.includes("investor")) {
    score += 10;
    reasons.push("Lead tagged as investor — rental market signal weighted higher.");
  }

  return score;
}

function censusSignal(zipCtx: ZipContext, tags: string[], reasons: string[]): number {
  const { mobilityRate, renterShare, medianIncome } = zipCtx.census;
  let score = mobilityRate * 30;

  if (mobilityRate >= 0.2) {
    reasons.push(`High area mobility rate (${(mobilityRate * 100).toFixed(0)}%) — households are actively moving.`);
  }

  if (tags.includes("renter") || tags.includes("first-time")) {
    score += renterShare * 20;
    if (renterShare >= 0.4) {
      reasons.push(`${zipCtx.zip} has a large renter share — strong first-time-buyer pipeline.`);
    }
  }

  // Affordability heuristic: a broad middle income band converts best for first-time buyers.
  if (tags.includes("first-time") && medianIncome >= 55_000 && medianIncome <= 140_000) {
    score += 8;
  }

  return score;
}

/**
 * County vital-event rates arrive per capita (small decimals, e.g. 0.004).
 * Multiplying by 1000 approximates the conventional "per 1,000 residents"
 * scale these figures are normally reported on.
 */
function lifeEventSignal(county: CountyEvents, zipCtx: ZipContext, reasons: string[]): number {
  const per1000 = (rate: number) => rate * 1000;
  let score = 0;

  const divorceRate = per1000(county.divorcesPerCapita);
  if (divorceRate >= 3) {
    score += 22;
    reasons.push(`Elevated divorce rate in ${county.county} County (${divorceRate.toFixed(1)} per 1,000).`);
  }

  const deathRate = per1000(county.deathsPerCapita);
  if (deathRate >= 8) {
    score += 18;
    reasons.push(`Elevated mortality rate in ${county.county} County — probate/inheritance opportunity.`);
  }

  if (county.probateFilings > 0) {
    score += Math.min(county.probateFilings / 5, 20);
    reasons.push(`${county.probateFilings} active probate filing(s) in the county.`);
  }

  const marriageRate = per1000(county.marriagesPerCapita);
  if (marriageRate >= 6) {
    score += 10;
    reasons.push(`Active marriage rate in ${county.county} County — first-home purchase signal.`);
  }

  const totalMigration = county.migrationIn + county.migrationOut;
  if (totalMigration > 0) {
    const netInShare = county.migrationIn / totalMigration;
    if (netInShare >= 0.6) {
      score += 12;
      reasons.push(`Net in-migration into ${county.county} County — relocation demand.`);
    } else if (netInShare <= 0.4) {
      score += 6;
      reasons.push(`Net out-migration from ${county.county} County — sellers relocating.`);
    }
  }

  if (zipCtx.census.mobilityRate >= 0.2) score += 6;

  return clampScore(score);
}

function recommendedActionFor(tags: string[], zipCtx: ZipContext, lifeEventLikelihood: number): string {
  if (lifeEventLikelihood >= 55) return "Send life-event targeted outreach";
  if (tags.includes("investor") && zipCtx.rentalDemand.trend !== "down") return "Send investor opportunities";
  if (tags.includes("first-time") || tags.includes("renter")) return "Send first-time buyer guide";
  return "Add to standard nurture sequence";
}

export function scoreLead(lead: Lead, zipCtx: ZipContext, county: CountyEvents): PredictiveResult {
  const reasons: string[] = [];
  const tags = lead.tags.map((tag) => tag.trim().toLowerCase());

  const rentalScore = rentalMarketSignal(zipCtx, tags, reasons);
  const censusScore = censusSignal(zipCtx, tags, reasons);
  const lifeEventLikelihood = lifeEventSignal(county, zipCtx, reasons);

  const leadScore = clampScore(rentalScore * 0.4 + censusScore * 0.35 + lifeEventLikelihood * 0.25);
  const recommendedAction = recommendedActionFor(tags, zipCtx, lifeEventLikelihood);

  if (reasons.length === 0) reasons.push("No strong signals detected from ZIP, county, or lead tags.");

  return { leadScore, lifeEventLikelihood, recommendedAction, reasons };
}
