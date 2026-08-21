/**
 * WordPress content ingestion: turns raw HTML or Markdown copy into a
 * normalized Pattern the silo/funnel builders can classify and reuse.
 * Regex-based on purpose — this handles a handful of well-known
 * heading/link/offer shapes, so it doesn't need a new HTML/Markdown parsing
 * dependency.
 */

export type ContentSilo = "Life Events" | "Predictive Intelligence" | "Tools" | "Guides";

export interface PatternSection {
  heading: string;
  body: string;
}

export interface PatternCta {
  label: string;
  url?: string;
}

export interface Pattern {
  title: string;
  silo: ContentSilo;
  sections: PatternSection[];
  ctas: PatternCta[];
  offers: string[];
}

const HTML_HEADING = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
const MD_HEADING = /^#{1,6}\s+(.+)$/gm;
const HTML_LINK = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

const CTA_WORDS = [
  "book", "claim", "get", "sign up", "download", "contact", "learn more",
  "join", "start", "schedule", "reserve", "apply", "request",
];

const OFFER_WORDS = ["%", "free", "off", "$", "limited time", "offer", "discount", "trial", "save"];

const SILO_KEYWORDS: Record<Exclude<ContentSilo, "Guides">, string[]> = {
  "Life Events": ["probate", "divorce", "marriage", "married", "death", "inheritance", "relocat", "widow", "estate"],
  "Predictive Intelligence": ["predict", "score", "likelihood", "model", "ai ", "data-driven", "signal"],
  Tools: ["calculator", "tool", "checker", "estimate", "estimator"],
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isHtml(raw: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(raw);
}

function extractHeadings(raw: string): { heading: string; index: number }[] {
  const headings: { heading: string; index: number }[] = [];
  if (isHtml(raw)) {
    for (const match of raw.matchAll(HTML_HEADING)) {
      headings.push({ heading: stripTags(match[2]), index: match.index ?? 0 });
    }
  } else {
    for (const match of raw.matchAll(MD_HEADING)) {
      headings.push({ heading: match[1].trim(), index: match.index ?? 0 });
    }
  }
  return headings.filter((h) => h.heading.length > 0);
}

function extractSections(raw: string, headings: { heading: string; index: number }[]): PatternSection[] {
  if (headings.length === 0) {
    const body = stripTags(raw);
    return body ? [{ heading: "Overview", body }] : [];
  }

  return headings.map((h, i) => {
    const end = i + 1 < headings.length ? headings[i + 1].index : raw.length;
    const chunk = raw.slice(h.index, end);
    const withoutHeadingLine = isHtml(raw) ? chunk.replace(HTML_HEADING, "") : chunk.replace(/^#{1,6}\s+.+$/m, "");
    return { heading: h.heading, body: stripTags(withoutHeadingLine) };
  });
}

function extractCtas(raw: string): PatternCta[] {
  const ctas: PatternCta[] = [];
  const html = isHtml(raw);
  const matches = raw.matchAll(html ? HTML_LINK : MD_LINK);

  for (const match of matches) {
    const [, first, second] = match;
    const [url, rawLabel] = html ? [first, second] : [second, first];
    const label = html ? stripTags(rawLabel) : rawLabel;
    if (!label) continue;

    const lower = label.toLowerCase();
    if (CTA_WORDS.some((word) => lower.includes(word))) {
      ctas.push({ label: label.trim(), url: url?.trim() || undefined });
    }
  }
  return ctas;
}

function extractOffers(raw: string): string[] {
  const sentences = stripTags(raw).split(/(?<=[.!?])\s+/);
  const offers = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return OFFER_WORDS.some((word) => lower.includes(word));
  });
  return Array.from(new Set(offers.map((s) => s.trim()))).slice(0, 5);
}

function classifySilo(title: string, sections: PatternSection[]): ContentSilo {
  const haystack = `${title} ${sections.map((s) => `${s.heading} ${s.body}`).join(" ")}`.toLowerCase();

  for (const silo of Object.keys(SILO_KEYWORDS) as (keyof typeof SILO_KEYWORDS)[]) {
    if (SILO_KEYWORDS[silo].some((word) => haystack.includes(word))) return silo;
  }
  return "Guides";
}

export function parseContent(raw: string): Pattern {
  const headings = extractHeadings(raw);
  const title = headings[0]?.heading.trim() || "Untitled";
  const sections = extractSections(raw, headings);
  const ctas = extractCtas(raw);
  const offers = extractOffers(raw);

  return { title, silo: classifySilo(title, sections), sections, ctas, offers };
}
