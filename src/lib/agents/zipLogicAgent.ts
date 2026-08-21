import { fetchLiveTerritory } from "@/lib/live-territory";
import { checkTerritory } from "@/lib/territory";

/**
 * Thin, read-only wrapper around the existing ZIP/territory logic
 * (src/lib/territory.ts, src/lib/live-territory.ts) for the agent
 * orchestrator. Mirrors the live-then-local fallback used by
 * /api/territory/check — no new territory business logic lives here.
 */

export interface ZipLogicResult {
  zip: string;
  valid: boolean;
  available: boolean;
  totalClaimed: number;
  message: string;
  source: "ypnus_wp" | "local_demo";
}

async function resolveZip(zip: string): Promise<ZipLogicResult> {
  const live = await fetchLiveTerritory(zip);
  if (live) {
    return {
      zip: live.zip,
      valid: live.valid,
      available: live.available,
      totalClaimed: live.totalClaimed,
      message: live.message,
      source: "ypnus_wp",
    };
  }
  const local = checkTerritory(zip);
  return { ...local, source: "local_demo" };
}

export async function suggestTerritory(
  zip: string,
): Promise<ZipLogicResult & { recommendation: string }> {
  const result = await resolveZip(zip);
  const recommendation = !result.valid
    ? "Ask for a valid 5-digit ZIP code."
    : result.available
      ? "Open — recommend claiming it now before another officer does."
      : "Already claimed — recommend joining the waitlist for reopen alerts.";
  return { ...result, recommendation };
}

export async function scoreZip(zip: string): Promise<{ zip: string; score: number; reason: string }> {
  const result = await resolveZip(zip);
  if (!result.valid) return { zip, score: 0, reason: "Invalid ZIP code." };
  const score = result.available ? 90 : 15;
  const reason = result.available
    ? "Unclaimed territory — high-priority opportunity."
    : "Territory already owned by another officer.";
  return { zip: result.zip, score, reason };
}

export async function explainZip(zip: string): Promise<{ zip: string; explanation: string }> {
  const result = await resolveZip(zip);
  return { zip: result.zip, explanation: result.message };
}
