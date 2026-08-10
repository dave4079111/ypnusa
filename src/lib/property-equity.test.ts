import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-equity-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("property equity snapshot", async () => {
  const { POST } = await import("../app/api/property/evaluate/route");
  const { readDb } = await import("./db");
  const { buildNurtureDashboard } = await import("./nurture-dashboard");
  const { calculatePropertyEquity } = await import("./property-equity");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("calculates equity, LTV, and an illustrative 80% cash-out ceiling", () => {
    assert.deepEqual(
      calculatePropertyEquity({
        estimatedHomeValueUsd: 600_000,
        currentMortgageBalanceUsd: 300_000,
      }),
      {
        estimatedHomeValueUsd: 600_000,
        currentMortgageBalanceUsd: 300_000,
        estimatedEquityUsd: 300_000,
        illustrativeCashOutUsd: 180_000,
        estimatedLtvPct: 50,
      },
    );
  });

  it("keeps negative equity visible while preventing a negative cash-out estimate", () => {
    const snapshot = calculatePropertyEquity({
      estimatedHomeValueUsd: 300_000,
      currentMortgageBalanceUsd: 340_000,
    });

    assert.equal(snapshot.estimatedEquityUsd, -40_000);
    assert.equal(snapshot.illustrativeCashOutUsd, 0);
    assert.equal(snapshot.estimatedLtvPct, 113.3);
  });

  it("returns anonymous estimates without storing contact data", async () => {
    const response = await POST(
      new Request("http://localhost/api/property/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "198.51.100.1" },
        body: JSON.stringify({
          zip: "93618",
          estimatedHomeValueUsd: 500_000,
          currentMortgageBalanceUsd: 250_000,
        }),
      }),
    );
    const body = (await response.json()) as { ok: boolean; saved: boolean };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.saved, false);
    assert.equal(readDb().propertyEvaluations.length, 0);
  });

  it("persists only explicitly consented MLO review requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/property/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "198.51.100.2" },
        body: JSON.stringify({
          zip: "93618",
          estimatedHomeValueUsd: 500_000,
          currentMortgageBalanceUsd: 250_000,
          name: "Taylor Borrower",
          email: "taylor@example.com",
          phone: "+15555550123",
          contactConsent: true,
        }),
      }),
    );
    const body = (await response.json()) as { ok: boolean; saved: boolean };
    const stored = readDb().propertyEvaluations;

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.saved, true);
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.email, "taylor@example.com");
    assert.equal(stored[0]?.contactConsent, true);
    assert.deepEqual(buildNurtureDashboard().equityReviews[0], {
      evaluationId: stored[0]?.id,
      borrowerName: "Taylor B.",
      zip: "93618",
      estimatedEquityUsd: 250_000,
      illustrativeCashOutUsd: 150_000,
      estimatedLtvPct: 50,
      createdAt: stored[0]?.createdAt,
    });
  });
});
