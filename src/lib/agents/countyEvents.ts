import type { CountyEvents } from "./predictiveAgent";

/**
 * Isolates external data-fetching for CountyEvents. No vital-records or
 * migration provider is wired into this deployment yet — set the env vars
 * below to enable live data. Until then this returns a clearly-labeled
 * neutral placeholder so predictiveAgent still gets a well-formed
 * CountyEvents.
 */

const COUNTY_EVENTS_API_URL = process.env.COUNTY_EVENTS_API_URL?.trim();
const COUNTY_EVENTS_API_TOKEN = process.env.COUNTY_EVENTS_API_TOKEN?.trim();

type CountyEventFields = Omit<CountyEvents, "county">;

const NEUTRAL_COUNTY_EVENTS: CountyEventFields = {
  divorcesPerCapita: 0,
  marriagesPerCapita: 0,
  deathsPerCapita: 0,
  probateFilings: 0,
  newBirths: 0,
  migrationIn: 0,
  migrationOut: 0,
};

/**
 * TODO: wire to a real county vital-records/migration provider once
 * COUNTY_EVENTS_API_URL (and optionally COUNTY_EVENTS_API_TOKEN) are set —
 * e.g. a state vital statistics office, IRS county migration data, or a
 * probate-filing feed.
 */
export async function buildCountyEvents(county: string): Promise<CountyEvents> {
  if (!COUNTY_EVENTS_API_URL) {
    return { county, ...NEUTRAL_COUNTY_EVENTS };
  }

  try {
    const url = new URL(COUNTY_EVENTS_API_URL);
    url.searchParams.set("county", county);

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(COUNTY_EVENTS_API_TOKEN ? { Authorization: `Bearer ${COUNTY_EVENTS_API_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { county, ...NEUTRAL_COUNTY_EVENTS };

    const data = (await res.json()) as Partial<CountyEventFields>;
    return { county, ...NEUTRAL_COUNTY_EVENTS, ...data };
  } catch {
    return { county, ...NEUTRAL_COUNTY_EVENTS };
  }
}
