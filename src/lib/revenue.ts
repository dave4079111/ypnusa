import { readDb } from "./db";
import { getPricingTier, PRICING_TIERS, type PricingTierId } from "./pricing";
import type {
  BorrowerLeadRecord,
  DbShape,
  DemoRequestRecord,
  LeadQuality,
  LoanOfficerRecord,
  RevenueSubscriptionRecord,
} from "./types";

type FlowStageId = "intake" | "qualified" | "booked" | "subscription";

const DEFAULT_LIFETIME_MONTHS: Record<PricingTierId, number> = {
  free: 3,
  starter: 12,
  pro: 15,
  elite: 18,
};

const LEAD_PIPELINE_VALUE_CENTS: Record<LeadQuality, number> = {
  prime: 9500,
  strong: 6500,
  developing: 2500,
  watch: 1000,
};

const BOOKED_LEAD_VALUE_CENTS = 9000;
const DEMO_ATTRIBUTION_VALUE_CENTS = 2500;

function isPresentString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export interface RevenueTierSummary {
  tierId: PricingTierId;
  tierName: string;
  priceMonthlyCents: number;
  bookings: number;
  monthlyRevenueCents: number;
  zipBookingCount: number;
  countyBookingCount: number;
  zipRevenueCents: number;
  countyRevenueCents: number;
  sharePct: number;
  capacityNote: string;
  countyCapacityNote: string;
}

export interface RevenueFlowStage {
  id: FlowStageId;
  label: string;
  count: number;
  valueCents: number;
  conversionPct: number;
  detail: string;
}

export interface RevenueFlowLink {
  from: FlowStageId;
  to: FlowStageId;
  count: number;
  valueCents: number;
}

export interface MloLifetimeValueSummary {
  loId: string;
  name: string;
  email: string;
  planNames: string[];
  subscriptionCount: number;
  monthlyRevenueCents: number;
  projectedSubscriptionLtvCents: number;
  leadPipelineValueCents: number;
  lifetimeValueCents: number;
  leadCount: number;
  bookedLeadCount: number;
  demoRequestCount: number;
}

export interface RevenuePulseSummary {
  generatedAt: string;
  totals: {
    mrrCents: number;
    activeSubscriptions: number;
    claimedZipCount: number;
    countyTerritoryCount: number;
    demoRequestCount: number;
    borrowerLeadCount: number;
    analyticsEventCount: number;
    averageLtvPerMloCents: number;
  };
  tierBreakdown: RevenueTierSummary[];
  flow: {
    stages: RevenueFlowStage[];
    links: RevenueFlowLink[];
  };
  ltvByMlo: MloLifetimeValueSummary[];
  assumptions: string[];
}

function normalizeZip(value?: string): string | null {
  const zip = value?.replace(/\D/g, "").slice(0, 5) ?? "";
  return zip.length === 5 ? zip : null;
}

function inferTierFromDemoRequest(request: DemoRequestRecord): PricingTierId {
  const volume = request.monthlyLeadVolume?.toLowerCase() ?? "";
  if (volume.includes("whole") || volume.includes("brokerage") || volume.includes("branch")) {
    return "elite";
  }
  if (volume.includes("6") || volume.includes("20")) {
    return "pro";
  }
  if (volume.includes("2") || volume.includes("5")) {
    return "starter";
  }
  return "free";
}

function subscriptionMonthlyCents(subscription: RevenueSubscriptionRecord): number {
  if (subscription.status !== "active") return 0;
  if (subscription.source === "stripe") return subscription.monthlyPriceCents ?? 0;
  return subscription.monthlyPriceCents ?? getPricingTier(subscription.tier).priceMonthlyCents;
}

function isRevenueSubscriptionActive(subscription: RevenueSubscriptionRecord): boolean {
  return subscription.status === "active" || subscription.status === "trialing";
}

function leadPipelineValue(lead: BorrowerLeadRecord): number {
  return LEAD_PIPELINE_VALUE_CENTS[lead.qualification.leadQuality];
}

function collectActiveSubscriptions(db: DbShape): RevenueSubscriptionRecord[] {
  const active = db.revenueSubscriptions.filter(isRevenueSubscriptionActive);
  if (process.env.NODE_ENV === "production") {
    return active.filter(
      (subscription) =>
        subscription.source === "stripe" || subscription.source === "admin_adjustment",
    );
  }
  const claimedExplicitZips = new Set(
    active
      .flatMap((subscription) => subscription.claimedZips.map((zip) => normalizeZip(zip)))
      .filter(isPresentString),
  );

  const inferredFromDemos = db.demoRequests.reduce<RevenueSubscriptionRecord[]>((memo, request) => {
    const zip = normalizeZip(request.zip);
    if (!zip || claimedExplicitZips.has(zip)) return memo;
    claimedExplicitZips.add(zip);

    const tier = inferTierFromDemoRequest(request);
    memo.push({
      id: `sub_demo_${request.id}`,
      createdAt: request.createdAt,
      startedAt: request.createdAt,
      tier,
      status: request.status === "contacted" ? "active" : "trialing",
      source: "demo_request",
      ownerEmail: request.workEmail,
      company: request.company,
      claimedZips: [zip],
      monthlyPriceCents: getPricingTier(tier).priceMonthlyCents,
      lifetimeMonths: DEFAULT_LIFETIME_MONTHS[tier],
      attributedDemoRequestIds: [request.id],
    });
    return memo;
  }, []);

  return [...active, ...inferredFromDemos];
}

function countEvents(db: DbShape, type: string): number {
  return db.analyticsEvents.filter((event) => event.type === type).length;
}

function conversionPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round((current / previous) * 100);
}

function buildTierBreakdown(subscriptions: RevenueSubscriptionRecord[]): RevenueTierSummary[] {
  const totalMrrCents = subscriptions.reduce((sum, subscription) => sum + subscriptionMonthlyCents(subscription), 0);

  return PRICING_TIERS.map((tier) => {
    const matching = subscriptions.filter((subscription) => subscription.tier === tier.id);

    let zipRevenueCents = 0;
    let countyRevenueCents = 0;
    const monthlyRevenueCents = matching.reduce((sum, subscription) => {
      const monthly = subscriptionMonthlyCents(subscription);
      const zipUnits = subscription.claimedZips.length;
      const countyUnits = subscription.countyTerritories?.length ?? 0;
      const totalUnits = Math.max(zipUnits + countyUnits, 1);

      zipRevenueCents += Math.round(monthly * (zipUnits / totalUnits));
      countyRevenueCents += Math.round(monthly * (countyUnits / totalUnits));
      return sum + monthly;
    }, 0);

    return {
      tierId: tier.id,
      tierName: tier.name,
      priceMonthlyCents: tier.priceMonthlyCents,
      bookings: matching.length,
      monthlyRevenueCents,
      zipBookingCount: matching.reduce((sum, subscription) => sum + subscription.claimedZips.length, 0),
      countyBookingCount: matching.reduce(
        (sum, subscription) => sum + (subscription.countyTerritories?.length ?? 0),
        0,
      ),
      zipRevenueCents,
      countyRevenueCents,
      sharePct: totalMrrCents === 0 ? 0 : Math.round((monthlyRevenueCents / totalMrrCents) * 100),
      capacityNote: tier.capacityNote,
      countyCapacityNote: tier.countyCapacityNote,
    };
  });
}

function demoIdsForSubscriptions(subscriptions: RevenueSubscriptionRecord[]): Set<string> {
  return new Set(subscriptions.flatMap((subscription) => subscription.attributedDemoRequestIds ?? []));
}

function countMatchedDemos(
  officer: LoanOfficerRecord,
  subscriptions: RevenueSubscriptionRecord[],
  demos: DemoRequestRecord[],
): number {
  const attributedIds = demoIdsForSubscriptions(subscriptions);
  const ownerEmails = new Set(
    subscriptions.map((subscription) => subscription.ownerEmail?.toLowerCase()).filter(isPresentString),
  );
  ownerEmails.add(officer.email.toLowerCase());

  return demos.filter((demo) => {
    if (attributedIds.has(demo.id)) return true;
    return ownerEmails.has(demo.workEmail.toLowerCase());
  }).length;
}

function buildMloLifetimeValues(
  db: DbShape,
  subscriptions: RevenueSubscriptionRecord[],
): MloLifetimeValueSummary[] {
  return db.loanOfficers
    .map((officer) => {
      const ownedSubscriptions = subscriptions.filter((subscription) => subscription.ownerLoId === officer.id);
      const leads = db.borrowerLeads.filter((lead) => lead.assignedLoId === officer.id);
      const appointments = db.appointments.filter((appointment) => appointment.loId === officer.id);
      const monthlyRevenueCents = ownedSubscriptions.reduce(
        (sum, subscription) => sum + subscriptionMonthlyCents(subscription),
        0,
      );
      const projectedSubscriptionLtvCents = ownedSubscriptions.reduce((sum, subscription) => {
        const months = subscription.lifetimeMonths ?? DEFAULT_LIFETIME_MONTHS[subscription.tier];
        return sum + subscriptionMonthlyCents(subscription) * months;
      }, 0);
      const demoRequestCount = countMatchedDemos(officer, ownedSubscriptions, db.demoRequests);
      const leadPipelineValueCents =
        leads.reduce((sum, lead) => sum + leadPipelineValue(lead), 0) +
        appointments.length * BOOKED_LEAD_VALUE_CENTS +
        demoRequestCount * DEMO_ATTRIBUTION_VALUE_CENTS;

      return {
        loId: officer.id,
        name: officer.name,
        email: officer.email,
        planNames: ownedSubscriptions.map((subscription) => getPricingTier(subscription.tier).name),
        subscriptionCount: ownedSubscriptions.length,
        monthlyRevenueCents,
        projectedSubscriptionLtvCents,
        leadPipelineValueCents,
        lifetimeValueCents: projectedSubscriptionLtvCents + leadPipelineValueCents,
        leadCount: leads.length,
        bookedLeadCount: appointments.length,
        demoRequestCount,
      };
    })
    .sort((a, b) => b.lifetimeValueCents - a.lifetimeValueCents);
}

function buildRevenueFlow(db: DbShape, subscriptions: RevenueSubscriptionRecord[], mrrCents: number) {
  const intakeCount = Math.max(countEvents(db, "intake_started"), db.sessions.length, db.borrowerLeads.length);
  const qualifiedCount = Math.max(countEvents(db, "intake_completed"), db.borrowerLeads.length);
  const bookedCount = Math.max(countEvents(db, "appointment_booked"), db.appointments.length);
  const subscriptionCount = subscriptions.length;
  const qualifiedValueCents = db.borrowerLeads.reduce((sum, lead) => sum + leadPipelineValue(lead), 0);
  const bookedValueCents = qualifiedValueCents + bookedCount * BOOKED_LEAD_VALUE_CENTS;

  const stages: RevenueFlowStage[] = [
    {
      id: "intake",
      label: "AI intake",
      count: intakeCount,
      valueCents: qualifiedValueCents,
      conversionPct: 100,
      detail: "Started borrower sessions feeding the qualification engine.",
    },
    {
      id: "qualified",
      label: "Qualified leads",
      count: qualifiedCount,
      valueCents: qualifiedValueCents,
      conversionPct: conversionPct(qualifiedCount, intakeCount),
      detail: "Persisted LOS leads scored by quality band and routed to an MLO.",
    },
    {
      id: "booked",
      label: "Booked consults",
      count: bookedCount,
      valueCents: bookedValueCents,
      conversionPct: conversionPct(bookedCount, qualifiedCount),
      detail: "Calendar bookings add high-intent pipeline value.",
    },
    {
      id: "subscription",
      label: "Territory MRR",
      count: subscriptionCount,
      valueCents: mrrCents,
      conversionPct: conversionPct(subscriptionCount, Math.max(db.demoRequests.length, 1)),
      detail: "Active or trial territory subscriptions from seeded accounts and live ZIP claims.",
    },
  ];

  const links: RevenueFlowLink[] = [
    { from: "intake", to: "qualified", count: qualifiedCount, valueCents: qualifiedValueCents },
    { from: "qualified", to: "booked", count: bookedCount, valueCents: bookedValueCents },
    { from: "booked", to: "subscription", count: subscriptionCount, valueCents: mrrCents },
  ];

  return { stages, links };
}

export function summarizeRevenuePulse(): RevenuePulseSummary {
  const db = readDb();
  const subscriptions = collectActiveSubscriptions(db);
  const tierBreakdown = buildTierBreakdown(subscriptions);
  const mrrCents = tierBreakdown.reduce((sum, tier) => sum + tier.monthlyRevenueCents, 0);
  const ltvByMlo = buildMloLifetimeValues(db, subscriptions);
  const ltvValues = ltvByMlo.map((mlo) => mlo.lifetimeValueCents);
  const averageLtvPerMloCents =
    ltvValues.length === 0 ? 0 : Math.round(ltvValues.reduce((sum, value) => sum + value, 0) / ltvValues.length);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      mrrCents,
      activeSubscriptions: subscriptions.length,
      claimedZipCount: new Set(subscriptions.flatMap((subscription) => subscription.claimedZips)).size,
      countyTerritoryCount: subscriptions.reduce(
        (sum, subscription) => sum + (subscription.countyTerritories?.length ?? 0),
        0,
      ),
      demoRequestCount: db.demoRequests.length,
      borrowerLeadCount: db.borrowerLeads.length,
      analyticsEventCount: db.analyticsEvents.length,
      averageLtvPerMloCents,
    },
    tierBreakdown,
    flow: buildRevenueFlow(db, subscriptions, mrrCents),
    ltvByMlo,
    assumptions: [
      process.env.NODE_ENV === "production"
        ? "MRR includes only synchronized Stripe subscriptions and explicit administrative adjustments."
        : "Development MRR includes seeded subscriptions and inferred demo ZIP claims.",
      process.env.NODE_ENV === "production"
        ? "Demo requests never count as paid subscriptions."
        : "Unmatched development demo-request ZIPs become inferred subscriptions.",
      "MLO LTV combines projected subscription months with attributed lead, booking, and demo pipeline value.",
      "County and ZIP revenue is allocated proportionally across each subscription's claimed coverage units.",
    ],
  };
}
