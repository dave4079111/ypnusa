import type { ZipContext } from "./predictiveAgent";

/**
 * Isolates all external data-fetching for ZipContext. No county-lookup,
 * Census, or rental-demand provider is wired into this deployment yet —
 * set the env vars below to enable live data. Until then this returns a
 * clearly-labeled neutral placeholder so predictiveAgent still gets a
 * well-formed ZipContext.
 */

const COUNTY_LOOKUP_API_URL = process.env.COUNTY_LOOKUP_API_URL?.trim();
const CENSUS_API_BASE = process.env.CENSUS_API_BASE?.trim();
const CENSUS_API_KEY = process.env.CENSUS_API_KEY?.trim();
const RENTAL_DEMAND_API_URL = process.env.RENTAL_DEMAND_API_URL?.trim();
const RENTAL_DEMAND_API_TOKEN = process.env.RENTAL_DEMAND_API_TOKEN?.trim();

type CensusFields = ZipContext["census"];
type RentalDemandFields = ZipContext["rentalDemand"];

const NEUTRAL_CENSUS: CensusFields = {
  medianIncome: 0,
  renterShare: 0,
  ownerShare: 0,
  medianAge: 0,
  mobilityRate: 0,
};

const NEUTRAL_RENTAL_DEMAND: RentalDemandFields = {
  demandScore: 0,
  vacancyRate: 0,
  avgRent: 0,
  trend: "flat",
};

/**
 * TODO: wire to a real ZIP -> county lookup once COUNTY_LOOKUP_API_URL is
 * set (e.g. a HUD USPS ZIP crosswalk or Census geocoding endpoint).
 */
async function resolveCounty(zip: string): Promise<string> {
  if (!COUNTY_LOOKUP_API_URL) return "Unknown";

  try {
    const url = new URL(COUNTY_LOOKUP_API_URL);
    url.searchParams.set("zip", zip);
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return "Unknown";
    const data = (await res.json()) as { county?: string };
    return data.county?.trim() || "Unknown";
  } catch {
    return "Unknown";
  }
}

/**
 * TODO: wire to the Census Bureau ACS API once CENSUS_API_BASE (and
 * optionally CENSUS_API_KEY) are set, e.g.
 * https://api.census.gov/data/{year}/acs/acs5.
 */
async function fetchCensusFields(zip: string): Promise<CensusFields> {
  if (!CENSUS_API_BASE) return NEUTRAL_CENSUS;

  try {
    const url = new URL(CENSUS_API_BASE);
    url.searchParams.set("zip", zip);
    if (CENSUS_API_KEY) url.searchParams.set("key", CENSUS_API_KEY);

    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return NEUTRAL_CENSUS;
    const data = (await res.json()) as Partial<CensusFields>;
    return { ...NEUTRAL_CENSUS, ...data };
  } catch {
    return NEUTRAL_CENSUS;
  }
}

/**
 * TODO: wire to the rental-demand provider once RENTAL_DEMAND_API_URL (and
 * optionally RENTAL_DEMAND_API_TOKEN) are set.
 */
async function fetchRentalDemandFields(zip: string): Promise<RentalDemandFields> {
  if (!RENTAL_DEMAND_API_URL) return NEUTRAL_RENTAL_DEMAND;

  try {
    const url = new URL(RENTAL_DEMAND_API_URL);
    url.searchParams.set("zip", zip);

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(RENTAL_DEMAND_API_TOKEN ? { Authorization: `Bearer ${RENTAL_DEMAND_API_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return NEUTRAL_RENTAL_DEMAND;
    const data = (await res.json()) as Partial<RentalDemandFields>;
    return { ...NEUTRAL_RENTAL_DEMAND, ...data };
  } catch {
    return NEUTRAL_RENTAL_DEMAND;
  }
}

export async function buildZipContext(zip: string): Promise<ZipContext> {
  const [county, census, rentalDemand] = await Promise.all([
    resolveCounty(zip),
    fetchCensusFields(zip),
    fetchRentalDemandFields(zip),
  ]);

  return { zip, county, census, rentalDemand };
}
