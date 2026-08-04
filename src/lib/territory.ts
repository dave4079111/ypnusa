import { readDb, writeDb } from "./db";
import type { DemoRequestRecord } from "./types";

/**
 * Exclusive ZIP-code territory logic.
 *
 * A territory is a 5-digit ZIP that a single loan officer owns exclusively —
 * every borrower lead generated in that ZIP routes only to them. Availability is
 * computed from two sources:
 *   1. A seeded set of already-claimed metro ZIPs (creates realistic scarcity).
 *   2. Live reservations captured through the marketing site (demo requests that
 *      named a ZIP).
 *
 * This intentionally does not depend on an external ZIP database: it validates
 * format and answers "is this territory still open?" — which is the question a
 * prospective subscriber actually asks.
 */

/** Pre-claimed ZIPs across major metros so popular areas read as "taken". */
const SEED_CLAIMED = new Set<string>([
  // Los Angeles / SoCal
  "90001", "90012", "90210", "90402", "91001", "92101", "92660", "92672",
  // SF Bay Area
  "94103", "94301", "94538", "95014", "95112",
  // Phoenix / AZ
  "85001", "85251", "85254", "85281",
  // Las Vegas / NV
  "89101", "89109", "89135", "89148",
  // Dallas / Austin / Houston TX
  "75201", "75204", "77002", "78701", "78704",
  // Miami / Orlando FL
  "33101", "33139", "33301", "32801",
  // Atlanta GA
  "30301", "30305", "30309",
  // NYC metro
  "10001", "10011", "10016", "11201",
  // Chicago
  "60601", "60614",
  // Seattle / Denver
  "98101", "98004", "80202", "80206",
]);

export interface TerritoryCheckResult {
  ok: boolean;
  zip: string;
  valid: boolean;
  available: boolean;
  /** Total territories claimed nationwide (seed + live) — powers scarcity copy. */
  totalClaimed: number;
  message: string;
}

export function normalizeZip(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

function liveClaimedZips(): Set<string> {
  const db = readDb();
  return liveClaimedZipsFromRequests(db.demoRequests);
}

function liveClaimedZipsFromRequests(
  demoRequests: DemoRequestRecord[],
): Set<string> {
  const claimed = new Set<string>();
  demoRequests.forEach((request) => {
    const zip = normalizeZip(request.zip);
    if (isValidZip(zip)) claimed.add(zip);
  });
  return claimed;
}

export function totalClaimedTerritories(): number {
  const merged = new Set<string>([...SEED_CLAIMED, ...liveClaimedZips()]);
  return merged.size;
}

export function checkTerritory(rawZip: unknown): TerritoryCheckResult {
  const zip = normalizeZip(rawZip);
  const totalClaimed = totalClaimedTerritories();

  if (!isValidZip(zip)) {
    return {
      ok: true,
      zip,
      valid: false,
      available: false,
      totalClaimed,
      message: "Enter a valid 5-digit ZIP code to check territory availability.",
    };
  }

  const claimed = SEED_CLAIMED.has(zip) || liveClaimedZips().has(zip);

  return {
    ok: true,
    zip,
    valid: true,
    available: !claimed,
    totalClaimed,
    message: claimed
      ? `Territory ${zip} is already owned. Join the waitlist and we'll alert you the moment it reopens.`
      : `Territory ${zip} is available — reserve it before another officer does.`,
  };
}

export function appendDemoRequestWithTerritoryCheck(
  record: DemoRequestRecord,
): TerritoryCheckResult | null {
  const zip = normalizeZip(record.zip);
  if (!zip) {
    writeDb((db) => db.demoRequests.push(record));
    return null;
  }

  let territory: TerritoryCheckResult = {
    ok: true,
    zip,
    valid: false,
    available: false,
    totalClaimed: 0,
    message: "Enter a valid 5-digit ZIP code to check territory availability.",
  };

  writeDb((db) => {
    const claimedZips = liveClaimedZipsFromRequests(db.demoRequests);
    const totalClaimed = new Set<string>([...SEED_CLAIMED, ...claimedZips]).size;

    if (!isValidZip(zip)) {
      territory = {
        ok: true,
        zip,
        valid: false,
        available: false,
        totalClaimed,
        message: "Enter a valid 5-digit ZIP code to check territory availability.",
      };
      db.demoRequests.push(record);
      return;
    }

    const claimed = SEED_CLAIMED.has(zip) || claimedZips.has(zip);
    territory = {
      ok: true,
      zip,
      valid: true,
      available: !claimed,
      totalClaimed,
      message: claimed
        ? `Territory ${zip} is already owned. Join the waitlist and we'll alert you the moment it reopens.`
        : `Territory ${zip} is available — reserve it before another officer does.`,
    };

    db.demoRequests.push(record);
  });

  return territory;
}
