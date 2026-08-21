import { WP_API_BASE } from "./site";
import { isValidZip, normalizeZip, type TerritoryCheckResult } from "./territory";

export interface LiveZipCheckResponse {
  success?: boolean;
  zip?: string;
  city?: string;
  state?: string;
  available?: boolean;
  urgency?: string;
  message?: string;
  signup_url?: string;
  demand?: {
    window_days?: number;
    total?: number;
    sellers?: number;
    buyers?: number;
    movers_in?: number;
  };
  status?: string;
  plan?: string;
}

/**
 * Ask the live WordPress territory ledger (ypnus.com) for ZIP availability.
 * Returns null when the remote API is unreachable so callers can fall back
 * to the local demo store.
 */
export async function fetchLiveTerritory(
  rawZip: unknown,
): Promise<(TerritoryCheckResult & { live?: LiveZipCheckResponse }) | null> {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) {
    return {
      ok: true,
      zip,
      valid: false,
      available: false,
      totalClaimed: 0,
      message: "Enter a valid 5-digit ZIP code to check territory availability.",
    };
  }

  const url = `${WP_API_BASE}/zip-check/${encodeURIComponent(zip)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Territory availability should stay fresh.
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn(`[live-territory] zip-check for ${zip} returned HTTP ${res.status}; using local data.`);
      return null;
    }
    const data = (await res.json()) as LiveZipCheckResponse;
    if (typeof data.available !== "boolean") {
      console.warn(
        `[live-territory] zip-check for ${zip} returned an unusable payload; using local data.`,
      );
      return null;
    }

    const place =
      data.city && data.state ? `${data.city}, ${data.state}` : `ZIP ${zip}`;
    const demand =
      typeof data.demand?.total === "number"
        ? ` ~${data.demand.total} people buying, selling, or moving in the next ${data.demand.window_days ?? 60} days.`
        : "";

    return {
      ok: true,
      zip,
      valid: true,
      available: data.available,
      totalClaimed: 0,
      message:
        data.message?.trim() ||
        (data.available
          ? `${place} is open.${demand}`
          : `${place} is exclusively locked.${demand}`),
      live: data,
    };
  } catch (error) {
    console.warn(
      `[live-territory] zip-check for ${zip} failed; using local data.`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
