import { MARKETING_SITE_URL } from "./site";

export type LocalSeoPageKind = "city" | "zip";

export interface LocalMetric {
  label: string;
  value?: string;
  asOf?: string;
  sourceName: string;
  sourceUrl: string;
}

export interface LocalSeoProfile {
  kind: LocalSeoPageKind;
  slug: string;
  city: string;
  stateCode: string;
  stateName: string;
  county: string;
  zipCodes: string[];
  neighborhoods: string[];
  headline: string;
  introduction: string;
  marketContext: string;
  localProcess: string;
  municipalName: string;
  municipalUrl: string;
  latitude: number;
  longitude: number;
  metrics: LocalMetric[];
}

export interface PublicBusinessProfile {
  name: string;
  phone?: string;
  email?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  nmlsId?: string;
  placeId?: string;
  profileUrl?: string;
}

export interface VerifiedReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  publishedAt?: string;
  sourceUrl?: string;
}

export interface ReviewFeed {
  status: "available" | "unconfigured" | "unavailable";
  reviews: VerifiedReview[];
  message: string;
}

const CENSUS_QUICKFACTS = "https://www.census.gov/quickfacts/";

const CITY_PROFILES: LocalSeoProfile[] = [
  {
    kind: "city",
    slug: "fresno-ca",
    city: "Fresno",
    stateCode: "CA",
    stateName: "California",
    county: "Fresno County",
    zipCodes: ["93720", "93722"],
    neighborhoods: ["Tower District", "Woodward Park", "Sunnyside"],
    headline: "Mortgage guidance built around Fresno buyers",
    introduction:
      "Fresno borrowers balance established neighborhoods, newer north-side inventory, and nearby rural properties. This page routes local questions to the configured mortgage contact serving Fresno rather than presenting a generic national lead form.",
    marketContext:
      "Loan structure can change with property type, occupancy, down-payment resources, and whether a home sits inside city limits or an eligible surrounding area. A local review helps separate those details before a borrower compares programs.",
    localProcess:
      "Start with the target neighborhood or ZIP, intended occupancy, and purchase timeline. The assigned mortgage professional can then discuss program fit and identify which county or municipal records should be verified for the specific property.",
    municipalName: "City of Fresno",
    municipalUrl: "https://www.fresno.gov/",
    latitude: 36.7378,
    longitude: -119.7871,
    metrics: [
      {
        label: "Housing and household estimates",
        sourceName: "U.S. Census Bureau QuickFacts",
        sourceUrl: `${CENSUS_QUICKFACTS}fact/table/fresnocitycalifornia/PST045224`,
      },
      {
        label: "Property tax details",
        sourceName: "Fresno County Auditor-Controller/Treasurer-Tax Collector",
        sourceUrl: "https://www2.co.fresno.ca.us/0410/",
      },
    ],
  },
  {
    kind: "city",
    slug: "clovis-ca",
    city: "Clovis",
    stateCode: "CA",
    stateName: "California",
    county: "Fresno County",
    zipCodes: ["93612", "93619"],
    neighborhoods: ["Old Town Clovis", "Loma Vista", "Harlan Ranch"],
    headline: "A local mortgage starting point for Clovis",
    introduction:
      "Clovis buyers may be comparing established streets near Old Town with newer communities farther east. This page gives those borrowers a locally framed path to the configured mortgage contact without inventing market statistics or availability.",
    marketContext:
      "New construction timelines, homeowners association costs, occupancy plans, and property location can each affect a financing conversation. Those details should be reviewed against current lender and public-record information for the actual address.",
    localProcess:
      "Share the target ZIP, property type, and expected timing first. The assigned professional can explain relevant loan options and flag taxes, insurance, or community costs that need confirmation before a complete estimate.",
    municipalName: "City of Clovis",
    municipalUrl: "https://www.clovisca.gov/",
    latitude: 36.8252,
    longitude: -119.7029,
    metrics: [
      {
        label: "Housing and household estimates",
        sourceName: "U.S. Census Bureau QuickFacts",
        sourceUrl: `${CENSUS_QUICKFACTS}fact/table/cloviscitycalifornia/PST045224`,
      },
      {
        label: "Property tax details",
        sourceName: "Fresno County Auditor-Controller/Treasurer-Tax Collector",
        sourceUrl: "https://www2.co.fresno.ca.us/0410/",
      },
    ],
  },
];

const ZIP_PROFILES: LocalSeoProfile[] = [
  {
    kind: "zip",
    slug: "93720",
    city: "Fresno",
    stateCode: "CA",
    stateName: "California",
    county: "Fresno County",
    zipCodes: ["93720"],
    neighborhoods: ["Woodward Park", "Fort Washington", "Pinedale"],
    headline: "Mortgage help for homes in Fresno ZIP 93720",
    introduction:
      "ZIP 93720 covers a north Fresno service area that includes established and newer housing near Woodward Park. Borrowers can use this page to reach the mortgage professional assigned to this territory and begin with property-specific facts.",
    marketContext:
      "The ZIP alone does not determine loan eligibility, taxes, insurance, or value. Property address, occupancy, borrower qualifications, and current program rules still require individual verification.",
    localProcess:
      "Provide the property address or nearby cross streets, purchase or refinance goal, and timing. The assigned professional can then prepare a focused next-step list without treating area-wide estimates as a quote.",
    municipalName: "City of Fresno",
    municipalUrl: "https://www.fresno.gov/",
    latitude: 36.8589,
    longitude: -119.7654,
    metrics: [
      {
        label: "ZIP-level housing estimates",
        sourceName: "U.S. Census Bureau data portal",
        sourceUrl: "https://data.census.gov/",
      },
      {
        label: "Parcel and property tax records",
        sourceName: "Fresno County",
        sourceUrl: "https://www.co.fresno.ca.us/departments/assessor",
      },
    ],
  },
  {
    kind: "zip",
    slug: "93612",
    city: "Clovis",
    stateCode: "CA",
    stateName: "California",
    county: "Fresno County",
    zipCodes: ["93612"],
    neighborhoods: ["Old Town Clovis", "Tarpey Village", "Sierra Vista"],
    headline: "Local mortgage guidance for Clovis ZIP 93612",
    introduction:
      "ZIP 93612 includes central Clovis neighborhoods and nearby commercial corridors. This territory page connects borrowers with the configured local mortgage professional while keeping public data and lending guidance clearly separated.",
    marketContext:
      "Property condition, insurance, occupancy, and exact jurisdiction can matter more than a ZIP-wide average. Any tax or housing figure should be checked against a dated public source and the specific parcel.",
    localProcess:
      "Begin with the address, property type, financing goal, and target closing window. The assigned professional can identify the documents and current program details needed for a personalized discussion.",
    municipalName: "City of Clovis",
    municipalUrl: "https://www.clovisca.gov/",
    latitude: 36.8105,
    longitude: -119.7109,
    metrics: [
      {
        label: "ZIP-level housing estimates",
        sourceName: "U.S. Census Bureau data portal",
        sourceUrl: "https://data.census.gov/",
      },
      {
        label: "Parcel and property tax records",
        sourceName: "Fresno County",
        sourceUrl: "https://www.co.fresno.ca.us/departments/assessor",
      },
    ],
  },
];

export const LOCAL_SEO_PROFILES = [...CITY_PROFILES, ...ZIP_PROFILES];

export const LOCAL_SEO_PUBLIC_ORIGIN =
  process.env.LOCAL_SEO_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || MARKETING_SITE_URL;

export function getLocalSeoProfile(
  kind: LocalSeoPageKind,
  rawSlug: string,
): LocalSeoProfile | undefined {
  const slug = rawSlug.trim().toLowerCase();
  return LOCAL_SEO_PROFILES.find((profile) => profile.kind === kind && profile.slug === slug);
}

export function getLocalSeoPath(profile: LocalSeoProfile): string {
  return profile.kind === "city"
    ? `/mortgage-broker/${profile.slug}`
    : `/zip/${profile.slug}`;
}

export function getPublicBusinessProfile(): PublicBusinessProfile {
  return {
    name: process.env.MLO_PUBLIC_NAME?.trim() || "YPN USA",
    phone: process.env.MLO_PUBLIC_PHONE?.trim() || "+1-559-205-6940",
    email: process.env.MLO_PUBLIC_EMAIL?.trim() || "support@ypnus.com",
    streetAddress: process.env.MLO_PUBLIC_STREET_ADDRESS?.trim() || undefined,
    locality: process.env.MLO_PUBLIC_LOCALITY?.trim() || undefined,
    region: process.env.MLO_PUBLIC_REGION?.trim() || undefined,
    postalCode: process.env.MLO_PUBLIC_POSTAL_CODE?.trim() || undefined,
    nmlsId: process.env.MLO_NMLS_ID?.trim() || undefined,
    placeId: process.env.GBP_PLACE_ID?.trim() || undefined,
    profileUrl: normalizeHttpUrl(process.env.GBP_PROFILE_URL),
  };
}

export function buildGoogleReviewUrl(placeId?: string): string | undefined {
  const normalized = placeId?.trim();
  if (!normalized) return undefined;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(normalized)}`;
}

function normalizeHttpUrl(rawUrl?: string): string | undefined {
  if (!rawUrl?.trim()) return undefined;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parseVerifiedReviews(payload: unknown): VerifiedReview[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate as Record<string, unknown>;
    const author = typeof record.author === "string" ? record.author.trim() : "";
    const text = typeof record.text === "string" ? record.text.trim() : "";
    const rating = typeof record.rating === "number" ? record.rating : Number.NaN;
    if (!author || !text || !Number.isInteger(rating) || rating < 1 || rating > 5) return [];

    return [
      {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `configured-review-${index}`,
        author,
        text,
        rating,
        publishedAt:
          typeof record.publishedAt === "string" ? record.publishedAt.trim() || undefined : undefined,
        sourceUrl:
          typeof record.sourceUrl === "string" ? normalizeHttpUrl(record.sourceUrl) : undefined,
      },
    ];
  });
}

export async function loadGbpReviews(profile: PublicBusinessProfile): Promise<ReviewFeed> {
  const providerUrl = normalizeHttpUrl(process.env.GBP_REVIEWS_PROVIDER_URL);

  if (providerUrl && profile.placeId) {
    try {
      const url = new URL(providerUrl);
      url.searchParams.set("placeId", profile.placeId);
      const token = process.env.GBP_REVIEWS_PROVIDER_TOKEN?.trim();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        next: { revalidate: 3600 },
      });
      if (!response.ok) throw new Error(`review provider returned ${response.status}`);
      const body = (await response.json()) as unknown;
      const reviews = parseVerifiedReviews(
        body && typeof body === "object" && "reviews" in body
          ? (body as { reviews: unknown }).reviews
          : body,
      );
      return {
        status: "available",
        reviews,
        message:
          reviews.length > 0
            ? "Verified review data supplied by the configured provider."
            : "The configured provider returned no publishable reviews.",
      };
    } catch (error) {
      console.warn(
        "[local-seo] Verified review provider request failed.",
        error instanceof Error ? error.message : error,
      );
      return {
        status: "unavailable",
        reviews: [],
        message: "Verified Google review data is temporarily unavailable.",
      };
    }
  }

  const configuredJson = process.env.GBP_VERIFIED_REVIEWS_JSON?.trim();
  if (configuredJson) {
    try {
      const reviews = parseVerifiedReviews(JSON.parse(configuredJson) as unknown);
      return {
        status: "available",
        reviews,
        message:
          reviews.length > 0
            ? "Verified review data supplied by site configuration."
            : "No valid configured reviews are available.",
      };
    } catch (error) {
      console.warn(
        "[local-seo] GBP_VERIFIED_REVIEWS_JSON is not valid JSON.",
        error instanceof Error ? error.message : error,
      );
      return {
        status: "unavailable",
        reviews: [],
        message: "Configured review data could not be validated.",
      };
    }
  }

  return {
    status: "unconfigured",
    reviews: [],
    message:
      "Google reviews are not connected yet. Reviews will appear only after a verified provider is configured.",
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
