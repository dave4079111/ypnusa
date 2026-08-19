/**
 * Google My Business post/description agent. Deterministic, local-SEO-
 * phrased templates — no external API calls. generateGmbContent (the
 * original stub) now delegates to generateGMBPost/optimizeDescription below
 * so coreAgent's existing "gmb-generate" task keeps working unchanged.
 */

export interface GmbBusinessProfile {
  name: string;
  city: string;
  state: string;
  specialties?: string[];
}

export interface GmbAgentInput {
  profile: GmbBusinessProfile;
  goal: string;
}

export interface GmbAgentOutput {
  postText: string;
  description: string;
  keywordSuggestions: string[];
}

export interface GmbProfile {
  name: string;
  city: string;
  services: string[];
  keywords: string[];
}

export type GmbGoal = "update" | "promotion" | "announcement";

export interface GmbPostResult {
  postText: string;
  keywordSuggestions: string[];
}

export interface GmbDescriptionResult {
  description: string;
  keywordSuggestions: string[];
}

function goalOpener(goal: GmbGoal): string {
  switch (goal) {
    case "promotion":
      return "Special offer";
    case "announcement":
      return "Big news";
    case "update":
    default:
      return "What's new";
  }
}

function topServices(services: string[], max = 3): string {
  return services.slice(0, max).join(", ");
}

function suggestKeywords(profile: GmbProfile): string[] {
  const primaryService = profile.services[0] ?? "local";
  const base = [
    `${profile.city} ${primaryService}`.trim(),
    `${profile.name} reviews`,
    `best ${primaryService} near ${profile.city}`,
  ];
  return Array.from(new Set([...profile.keywords.slice(0, 5), ...base])).slice(0, 8);
}

export function generateGMBPost(profile: GmbProfile, goal: GmbGoal): GmbPostResult {
  const services = topServices(profile.services);
  const opener = goalOpener(goal);
  const promoNote = goal === "promotion" ? "Limited-time offer — " : "";

  const postText =
    `${opener} from ${profile.name} in ${profile.city}! ` +
    `We're your local team for ${services || "trusted, local service"}. ` +
    `${promoNote}Contact us today to get started.`;

  return { postText, keywordSuggestions: suggestKeywords(profile) };
}

export function optimizeDescription(profile: GmbProfile): GmbDescriptionResult {
  const services = topServices(profile.services, 5);

  const description =
    `${profile.name} proudly serves ${profile.city} and the surrounding area with ${services || "dependable, local service"}. ` +
    `Locally trusted, response-fast, and focused on getting it right the first time. ` +
    `Reach out to ${profile.name} in ${profile.city} today.`;

  return { description, keywordSuggestions: suggestKeywords(profile) };
}

function mapLegacyGoal(goal: string): GmbGoal {
  const g = goal.trim().toLowerCase();
  if (g.includes("promo") || g.includes("sale") || g.includes("offer")) return "promotion";
  if (g.includes("announce") || g.includes("launch") || g.includes("news")) return "announcement";
  return "update";
}

/** Bridges the original {profile: GmbBusinessProfile, goal: string} stub shape onto the richer functions above. */
export async function generateGmbContent(input: GmbAgentInput): Promise<GmbAgentOutput> {
  const profile: GmbProfile = {
    name: input.profile.name,
    city: input.profile.city,
    services: input.profile.specialties ?? [],
    keywords: [],
  };
  const goal = mapLegacyGoal(input.goal);

  const post = generateGMBPost(profile, goal);
  const described = optimizeDescription(profile);

  return {
    postText: post.postText,
    description: described.description,
    keywordSuggestions: Array.from(new Set([...post.keywordSuggestions, ...described.keywordSuggestions])).slice(0, 8),
  };
}
