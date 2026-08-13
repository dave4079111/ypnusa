import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { AnalyticsEventRecord, BorrowerLeadRecord, LeadQuality } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-analytics-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

let counter = 0;
function event(
  type: AnalyticsEventRecord["type"],
  payload: Record<string, unknown> = {},
): AnalyticsEventRecord {
  counter += 1;
  return { id: `evt_${counter}`, type, createdAt: "2026-02-02T00:00:00.000Z", payload };
}

function lead(quality: LeadQuality, overallScore?: number): BorrowerLeadRecord {
  counter += 1;
  return {
    id: `lead_${counter}`,
    createdAt: "2026-02-02T00:00:00.000Z",
    answers: { loanProgram: "CONVENTIONAL" },
    qualification: {
      programScores: overallScore === undefined ? {} : { overallScore },
      leadQuality: quality,
      urgency: "standard",
      recommendedNextStep: "Book a consult.",
      rationale: [],
    },
    assignedLoId: "lo_a",
    crmLeadId: `crm_${counter}`,
  };
}

describe("analytics pulse", async () => {
  const { writeDb } = await import("./db");
  const { summarizeAnalyticsPulse } = await import("./analytics-core");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  function seed(events: AnalyticsEventRecord[], leads: BorrowerLeadRecord[]) {
    writeDb((db) => {
      db.analyticsEvents = events;
      db.borrowerLeads = leads;
    });
  }

  it("returns an all-zero pulse for an empty store", () => {
    seed([], []);

    assert.deepEqual(summarizeAnalyticsPulse(), {
      totals: { sessionsStarted: 0, completions: 0, bookings: 0 },
      funnel: {},
      completionRatePct: 0,
      qualificationMixPct: { prime: 0, strong: 0, developing: 0, watch: 0 },
      bookingsCaptured: 0,
      averageLosCompositeScore: 0,
    });
  });

  it("tallies session, completion, and booking totals", () => {
    seed(
      [
        event("intake_started"),
        event("intake_started"),
        event("intake_progress"),
        event("intake_completed"),
        event("appointment_booked"),
        event("appointment_booked"),
        event("demo_requested"),
      ],
      [],
    );

    const pulse = summarizeAnalyticsPulse();

    assert.deepEqual(pulse.totals, { sessionsStarted: 2, completions: 1, bookings: 2 });
    assert.equal(pulse.bookingsCaptured, 2);
    assert.equal(pulse.completionRatePct, 50);
  });

  it("caps the completion rate at 100% when completions outnumber starts", () => {
    seed([event("intake_started"), event("intake_completed"), event("intake_completed")], []);

    assert.equal(summarizeAnalyticsPulse().completionRatePct, 100);
  });

  it("counts program demand only from intake events carrying a string program", () => {
    seed(
      [
        event("intake_started", { program: "FHA" }),
        event("intake_progress", { program: "FHA" }),
        event("intake_completed", { program: "VA" }),
        event("intake_started", { program: 42 }),
        event("intake_started"),
        event("appointment_booked", { program: "JUMBO" }),
      ],
      [],
    );

    assert.deepEqual(summarizeAnalyticsPulse().funnel, { FHA: 2, VA: 1 });
  });

  it("reports the qualification mix as rounded percentages of all leads", () => {
    seed([], [lead("prime", 90), lead("strong", 80), lead("developing", 60), lead("watch", 40)]);

    const pulse = summarizeAnalyticsPulse();

    assert.deepEqual(pulse.qualificationMixPct, {
      prime: 25,
      strong: 25,
      developing: 25,
      watch: 25,
    });
    assert.equal(pulse.averageLosCompositeScore, 68); // (90+80+60+40)/4 = 67.5
  });

  it("treats a lead with no composite score as a zero in the average", () => {
    seed([], [lead("prime", 100), lead("watch")]);

    const pulse = summarizeAnalyticsPulse();

    assert.equal(pulse.averageLosCompositeScore, 50);
    assert.equal(pulse.qualificationMixPct.prime, 50);
  });
});
