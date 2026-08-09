import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { DemoRequestRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-atomic-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function demo(id: string, zip: string): DemoRequestRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    name: id,
    workEmail: `${id}@example.com`,
    company: "Test Co",
    zip,
    source: "test",
    status: "new",
  };
}

describe("writeDb atomicity", async () => {
  const { readDb, writeDb } = await import("./db");
  const { appendDemoRequestWithTerritoryCheck } = await import("./territory");

  before(() => {
    writeDb((db) => {
      db.demoRequests.length = 0;
      db.analyticsEvents.length = 0;
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps nested writeDb updates instead of dropping the inner mutation", () => {
    writeDb((db) => {
      db.demoRequests.length = 0;
    });

    writeDb((outer) => {
      outer.demoRequests.push(demo("outer", "11111"));
      writeDb((inner) => {
        inner.demoRequests.push(demo("inner", "22222"));
      });
    });

    const ids = readDb().demoRequests.map((row) => row.id).sort();
    assert.deepEqual(ids, ["inner", "outer"]);
  });

  it("grants activation to the first ZIP claim and waitlists the second", () => {
    writeDb((db) => {
      db.demoRequests.length = 0;
    });

    const first = appendDemoRequestWithTerritoryCheck(demo("demo_1", "55555"));
    const second = appendDemoRequestWithTerritoryCheck(demo("demo_2", "55555"));
    const stored = readDb().demoRequests.map((row) => row.id);

    assert.equal(first?.available, true);
    assert.equal(second?.available, false);
    assert.deepEqual(stored, ["demo_1", "demo_2"]);
  });
});
