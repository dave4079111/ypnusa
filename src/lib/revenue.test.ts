import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type {
  AnalyticsEventRecord,
  BorrowerLeadRecord,
  DemoRequestRecord,
  LeadQuality,
  LoanOfficerRecord,
  RevenueSubscriptionRecord,
} from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-revenue-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const officers: LoanOfficerRecord[] = [
  {
    id: "lo_a",
    name: "Officer A",
    email: "owner-a@example.com",
    specialties: ["CONVENTIONAL"],
    weeklyWindows: [],
  },
  {
    id: "lo_b",
    name: "Officer B",
    email: "owner-b@example.com",
    specialties: ["JUMBO"],
    weeklyWindows: [],
  },
];

const subscriptions: RevenueSubscriptionRecord[] = [
  {
    id: "sub_pro",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    tier: "pro",
    status: "active",
    source: "seed",
    ownerLoId: "lo_a",
    ownerEmail: "owner-a@example.com",
    claimedZips: ["78701", "78702"],
    countyTerritories: ["Travis County, TX"],
    monthlyPriceCents: 9999,
    lifetimeMonths: 10,
  },
  {
    id: "sub_elite_trial",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    tier: "elite",
    status: "trialing",
    source: "seed",
    ownerLoId: "lo_b",
    ownerEmail: "owner-b@example.com",
    claimedZips: ["85004"],
  },
  {
    id: "sub_cancelled",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    tier: "starter",
    status: "cancelled",
    source: "seed",
    ownerLoId: "lo_a",
    ownerEmail: "owner-a@example.com",
    claimedZips: ["94110"],
    monthlyPriceCents: 2999,
  },
];

function demoRequest(overrides: Partial<DemoRequestRecord> & { id: string }): DemoRequestRecord {
  return {
    createdAt: "2026-02-01T00:00:00.000Z",
    name: "Demo Requester",
    workEmail: `${overrides.id}@example.com`,
    company: "Demo Co",
    status: "new",
    ...overrides,
  };
}

function lead(id: string, quality: LeadQuality, assignedLoId: string): BorrowerLeadRecord {
  return {
    id,
    createdAt: "2026-02-02T00:00:00.000Z",
    answers: { loanProgram: "CONVENTIONAL" },
    qualification: {
      programScores: { overallScore: 80 },
      leadQuality: quality,
      urgency: "high",
      recommendedNextStep: "Book a consult.",
      rationale: [],
    },
    assignedLoId,
    crmLeadId: `crm_${id}`,
  };
}

function event(id: string, type: AnalyticsEventRecord["type"]): AnalyticsEventRecord {
  return { id, type, createdAt: "2026-02-02T00:00:00.000Z", payload: {} };
}

describe("revenue pulse", async () => {
  const { writeDb } = await import("./db");
  const { summarizeRevenuePulse } = await import("./revenue");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    writeDb((db) => {
      db.loanOfficers = officers;
      db.revenueSubscriptions = subscriptions;
      db.demoRequests = [
        demoRequest({ id: "demo_claimed", zip: "78701", status: "contacted", workEmail: "owner-a@example.com" }),
        demoRequest({ id: "demo_brokerage", zip: "60601", monthlyLeadVolume: "Whole brokerage" }),
        demoRequest({ id: "demo_no_zip", zip: "not-a-zip" }),
      ];
      db.borrowerLeads = [lead("lead_prime", "prime", "lo_a"), lead("lead_watch", "watch", "lo_a")];
      db.appointments = [
        {
          id: "appt_1",
          borrowerLeadId: "lead_prime",
          loId: "lo_a",
          start: "2026-02-03T17:00:00.000Z",
          end: "2026-02-03T17:30:00.000Z",
          createdAt: "2026-02-02T00:00:00.000Z",
        },
      ];
      db.analyticsEvents = [
        event("e1", "intake_started"),
        event("e2", "intake_started"),
        event("e3", "intake_started"),
        event("e4", "intake_completed"),
        event("e5", "appointment_booked"),
      ];
      db.sessions = [];
      db.crmLeads = [];
      db.followUps = [];
      db.loAlerts = [];
      db.propertyEvaluations = [];
    });
  });

  it("counts only active or trialing subscriptions toward MRR", () => {
    const pulse = summarizeRevenuePulse();

    // 9999 (pro) + 29999 (elite trial) + 29999 (inferred elite from the brokerage demo)
    assert.equal(pulse.totals.mrrCents, 69_997);
    assert.equal(pulse.totals.activeSubscriptions, 3);
    assert.ok(
      !pulse.ltvByMlo.some((mlo) => mlo.planNames.includes("Starter")),
      "a cancelled subscription must not be attributed",
    );
  });

  it("falls back to the catalog price when a subscription has no override", () => {
    const elite = summarizeRevenuePulse().tierBreakdown.find((tier) => tier.tierId === "elite");

    assert.equal(elite?.bookings, 2);
    assert.equal(elite?.monthlyRevenueCents, 59_998);
  });

  it("infers a subscription for unclaimed demo ZIPs and skips claimed or invalid ones", () => {
    const pulse = summarizeRevenuePulse();

    assert.equal(pulse.totals.demoRequestCount, 3);
    assert.deepEqual(new Set(["78701", "78702", "85004", "60601"]).size, pulse.totals.claimedZipCount);
    assert.equal(pulse.totals.countyTerritoryCount, 1);
  });

  it("allocates revenue proportionally across ZIP and county coverage units", () => {
    const pro = summarizeRevenuePulse().tierBreakdown.find((tier) => tier.tierId === "pro");

    assert.equal(pro?.zipBookingCount, 2);
    assert.equal(pro?.countyBookingCount, 1);
    assert.equal(pro?.zipRevenueCents, 6_666);
    assert.equal(pro?.countyRevenueCents, 3_333);
  });

  it("shares out MRR by tier and leaves empty tiers at zero", () => {
    const breakdown = summarizeRevenuePulse().tierBreakdown;
    const shares = Object.fromEntries(breakdown.map((tier) => [tier.tierId, tier.sharePct]));

    assert.equal(shares.free, 0);
    assert.equal(shares.starter, 0);
    assert.equal(shares.pro, 14);
    assert.equal(shares.elite, 86);
    assert.equal(breakdown.length, 4);
  });

  it("ranks MLOs by lifetime value from subscription months plus pipeline value", () => {
    const [first, second] = summarizeRevenuePulse().ltvByMlo;

    assert.equal(first?.loId, "lo_b");
    assert.equal(first?.projectedSubscriptionLtvCents, 539_982); // 29999 * default 18 months
    assert.equal(first?.leadPipelineValueCents, 0);

    assert.equal(second?.loId, "lo_a");
    assert.equal(second?.projectedSubscriptionLtvCents, 99_990); // 9999 * 10 months
    // prime 9500 + watch 1000 + one booking 9000 + one attributed demo 2500
    assert.equal(second?.leadPipelineValueCents, 22_000);
    assert.equal(second?.lifetimeValueCents, 121_990);
    assert.equal(second?.demoRequestCount, 1);
    assert.equal(second?.bookedLeadCount, 1);
    assert.equal(second?.leadCount, 2);
  });

  it("averages lifetime value across every MLO", () => {
    const pulse = summarizeRevenuePulse();

    assert.equal(pulse.totals.averageLtvPerMloCents, 330_986);
  });

  it("builds a funnel that never regresses below the persisted record counts", () => {
    const { stages, links } = summarizeRevenuePulse().flow;
    const byId = Object.fromEntries(stages.map((stage) => [stage.id, stage]));

    assert.deepEqual(
      stages.map((stage) => stage.id),
      ["intake", "qualified", "booked", "subscription"],
    );
    assert.equal(byId.intake?.count, 3);
    assert.equal(byId.qualified?.count, 2); // two persisted leads outrank one completion event
    assert.equal(byId.booked?.count, 1);
    assert.equal(byId.subscription?.count, 3);
    assert.equal(byId.intake?.conversionPct, 100);
    assert.equal(byId.qualified?.conversionPct, 67);
    assert.equal(byId.booked?.conversionPct, 50);
    assert.deepEqual(
      links.map((link) => `${link.from}->${link.to}`),
      ["intake->qualified", "qualified->booked", "booked->subscription"],
    );
    assert.equal(links.at(-1)?.valueCents, 69_997);
  });

  it("reports zeroed totals and assumptions for an empty ledger", () => {
    writeDb((db) => {
      db.loanOfficers = [];
      db.revenueSubscriptions = [];
      db.demoRequests = [];
      db.borrowerLeads = [];
      db.appointments = [];
      db.analyticsEvents = [];
    });

    const pulse = summarizeRevenuePulse();

    assert.equal(pulse.totals.mrrCents, 0);
    assert.equal(pulse.totals.activeSubscriptions, 0);
    assert.equal(pulse.totals.averageLtvPerMloCents, 0);
    assert.deepEqual(pulse.ltvByMlo, []);
    assert.ok(pulse.tierBreakdown.every((tier) => tier.sharePct === 0));
    assert.ok(pulse.assumptions.length > 0);
    assert.ok(!Number.isNaN(Date.parse(pulse.generatedAt)));
  });

  it("infers the tier from the stated team size wording", () => {
    const cases: Array<{ volume: string | undefined; tier: string }> = [
      { volume: "Whole brokerage", tier: "Elite" },
      { volume: "6-20 leads / month", tier: "Pro" },
      { volume: "2-5 leads / month", tier: "Starter" },
      { volume: "just me", tier: "Free" },
      { volume: undefined, tier: "Free" },
    ];

    for (const { volume, tier } of cases) {
      writeDb((db) => {
        db.loanOfficers = [];
        db.revenueSubscriptions = [];
        db.borrowerLeads = [];
        db.appointments = [];
        db.analyticsEvents = [];
        db.demoRequests = [demoRequest({ id: "demo_infer", zip: "10001", monthlyLeadVolume: volume })];
      });

      const inferred = summarizeRevenuePulse().tierBreakdown.filter((entry) => entry.bookings > 0);
      assert.deepEqual(
        inferred.map((entry) => entry.tierName),
        [tier],
        `volume "${String(volume)}" should infer ${tier}`,
      );
    }
  });
});
