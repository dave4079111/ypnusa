/**
 * Page-spec -> section JSON builder. Deterministic, template-based — no
 * external API calls, JSON only (no JSX), so existing Next.js components can
 * render from the output. buildWebsitePage (the original stub) now delegates
 * to buildPageSpec below so coreAgent's existing "website-build-page" task
 * keeps working unchanged.
 */

export interface WebsiteBuilderInput {
  goal: string;
  audience: string;
  sections: string[];
}

export interface WebsiteBuilderSection {
  id: string;
  headline: string;
  body: string;
  callToAction?: string;
}

export interface WebsiteBuilderOutput {
  sections: WebsiteBuilderSection[];
}

export interface PageSection {
  id: string;
  headline: string;
  subheadline: string;
  body: string;
  callToAction: string;
}

export interface PageSpec {
  goal: string;
  audience: string;
  sections: PageSection[];
}

function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function ctaFor(goal: string): string {
  const g = goal.trim().toLowerCase();
  if (g.includes("book") || g.includes("appointment") || g.includes("call")) return "Book your free consultation today.";
  if (g.includes("sign") || g.includes("subscribe") || g.includes("join")) return "Sign up now — it takes 60 seconds.";
  if (g.includes("download") || g.includes("guide")) return "Get the free guide.";
  if (g.includes("claim") || g.includes("territory") || g.includes("zip")) return "Claim your territory before it's gone.";
  return "Get started today.";
}

type SectionTemplate = (goal: string, audience: string) => Omit<PageSection, "id">;

const SECTION_TEMPLATES: Record<string, SectionTemplate> = {
  hero: (goal, audience) => ({
    headline: titleCase(goal),
    subheadline: `Built for ${audience}.`,
    body: `Everything you need to ${goal.toLowerCase()}, without the extra steps.`,
    callToAction: ctaFor(goal),
  }),
  features: (goal, audience) => ({
    headline: "Why it works",
    subheadline: `Designed around what ${audience} actually need.`,
    body: `Every feature exists to help you ${goal.toLowerCase()} faster and with less friction.`,
    callToAction: "See how it works",
  }),
  pricing: () => ({
    headline: "Simple, transparent pricing",
    subheadline: "No hidden fees.",
    body: "Pick the plan that fits and change anytime.",
    callToAction: "View pricing",
  }),
  faq: () => ({
    headline: "Frequently asked questions",
    subheadline: "Still have questions?",
    body: "Reach out and we'll walk you through it.",
    callToAction: "Contact us",
  }),
  testimonials: (goal, audience) => ({
    headline: "Trusted by people like you",
    subheadline: `Real results for ${audience}.`,
    body: `See how others used this to ${goal.toLowerCase()}.`,
    callToAction: "Read more stories",
  }),
};

function buildSection(name: string, goal: string, audience: string): PageSection {
  const key = name.trim().toLowerCase();
  const template =
    SECTION_TEMPLATES[key] ??
    ((g: string, a: string) => ({
      headline: titleCase(name),
      subheadline: `For ${a}.`,
      body: `${titleCase(g)} — tailored to what matters most.`,
      callToAction: ctaFor(g),
    }));
  return { id: key, ...template(goal, audience) };
}

export function buildPageSpec(goal: string, audience: string, sections: string[]): PageSpec {
  return { goal, audience, sections: sections.map((name) => buildSection(name, goal, audience)) };
}

export function buildLandingPage(goal: string, offer: string): PageSpec {
  const audience = "your ideal customer";

  const heroSection: PageSection = {
    id: "hero",
    headline: titleCase(offer),
    subheadline: titleCase(goal),
    body: `${titleCase(offer)} — built to help you ${goal.toLowerCase()}.`,
    callToAction: ctaFor(goal),
  };
  const offerSection: PageSection = {
    id: "offer",
    headline: "The Offer",
    subheadline: titleCase(offer),
    body: `${titleCase(offer)}. Available for a limited time.`,
    callToAction: ctaFor(goal),
  };
  const rest = ["features", "testimonials", "faq"].map((name) => buildSection(name, goal, audience));

  return { goal, audience, sections: [heroSection, offerSection, ...rest] };
}

/** Bridges the original {goal, audience, sections} stub shape onto buildPageSpec above. */
export async function buildWebsitePage(input: WebsiteBuilderInput): Promise<WebsiteBuilderOutput> {
  const spec = buildPageSpec(input.goal, input.audience, input.sections);
  return {
    sections: spec.sections.map(({ id, headline, body, callToAction }) => ({ id, headline, body, callToAction })),
  };
}
