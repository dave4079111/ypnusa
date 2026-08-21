/**
 * Marketing & social copy agent. Deterministic, template-based generation —
 * no external API calls. generateMarketingContent (the original stub) now
 * delegates to the three channel-specific generators below so coreAgent's
 * existing "marketing-generate" task keeps working unchanged.
 */

export type MarketingChannel = "social_post" | "email" | "caption" | "ad_copy";

export interface MarketingAgentInput {
  brandVoice: string;
  goal: string;
  channel: MarketingChannel;
  topic?: string;
}

export interface MarketingAgentOutput {
  channel: MarketingChannel;
  headline: string;
  body: string;
  callToAction: string;
}

export type PlatformChannel = "facebook" | "instagram" | "linkedin" | "email" | "sms" | "ad";

export interface MarketingRequest {
  brandVoice: string;
  goal: string;
  audience: string;
  channel: PlatformChannel;
  topic?: string;
}

export interface SocialPostResult {
  channel: PlatformChannel;
  headline: string;
  body: string;
  hashtags?: string[];
  callToAction: string;
}

export interface EmailResult {
  subject: string;
  preheader: string;
  body: string;
  callToAction: string;
}

export interface AdCopyResult {
  headline: string;
  primaryText: string;
  callToAction: string;
}

const PLATFORM_LIMITS: Record<PlatformChannel, number> = {
  facebook: 280,
  instagram: 220,
  linkedin: 300,
  email: 600,
  sms: 160,
  ad: 125,
};

function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function clipToLimit(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

function ctaFor(goal: string): string {
  const g = goal.trim().toLowerCase();
  if (g.includes("book") || g.includes("appointment") || g.includes("call")) return "Book your free consultation today.";
  if (g.includes("sign") || g.includes("subscribe") || g.includes("join")) return "Sign up now — it takes 60 seconds.";
  if (g.includes("download") || g.includes("guide")) return "Get the free guide.";
  if (g.includes("claim") || g.includes("territory") || g.includes("zip")) return "Claim your territory before it's gone.";
  return "Get started today.";
}

function deriveHashtags(...parts: string[]): string[] {
  return Array.from(
    new Set(
      parts
        .join(" ")
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .map((word) => `#${word.replace(/[^a-zA-Z0-9]/g, "")}`)
        .filter((tag) => tag.length > 1),
    ),
  ).slice(0, 4);
}

export function generateSocialPost(request: MarketingRequest): SocialPostResult {
  const { brandVoice, goal, audience, channel, topic } = request;
  const subject = topic?.trim() || goal.trim();
  const limit = PLATFORM_LIMITS[channel] ?? 220;

  const headline = titleCase(`${subject} — built for ${audience}`);
  const body = clipToLimit(
    `${titleCase(brandVoice)} take: ${goal}. Made for ${audience} who want results, not runaround.`,
    limit,
  );
  const hashtags = channel === "instagram" || channel === "facebook" ? deriveHashtags(subject, audience) : undefined;

  return { channel, headline, body, hashtags, callToAction: ctaFor(goal) };
}

export function generateEmail(request: MarketingRequest): EmailResult {
  const { brandVoice, goal, audience, topic } = request;
  const subjectTopic = topic?.trim() || goal.trim();

  const subject = titleCase(`${subjectTopic} for ${audience}`);
  const preheader = `A ${brandVoice.trim().toLowerCase()} note about ${goal.trim().toLowerCase()}.`;
  const callToAction = ctaFor(goal);
  const body =
    `Hi there,\n\n` +
    `${titleCase(brandVoice)} and to the point: ${goal.trim()}.\n\n` +
    `This is built specifically for ${audience}, so you get exactly what you need — no filler.\n\n` +
    `${callToAction}`;

  return { subject, preheader, body, callToAction };
}

export function generateAdCopy(request: MarketingRequest): AdCopyResult {
  const { goal, audience, topic } = request;
  const subject = topic?.trim() || goal.trim();

  const headline = clipToLimit(titleCase(subject), 40);
  const primaryText = clipToLimit(`${titleCase(subject)} for ${audience}. ${goal.trim()}.`, PLATFORM_LIMITS.ad);

  return { headline, primaryText, callToAction: ctaFor(goal) };
}

function mapLegacyChannel(channel: MarketingChannel): PlatformChannel {
  switch (channel) {
    case "email":
      return "email";
    case "ad_copy":
      return "ad";
    case "caption":
      return "instagram";
    case "social_post":
    default:
      return "facebook";
  }
}

/** Bridges the original {brandVoice, goal, channel, topic} stub shape (no audience) onto the richer generators above. */
export async function generateMarketingContent(input: MarketingAgentInput): Promise<MarketingAgentOutput> {
  const request: MarketingRequest = {
    brandVoice: input.brandVoice,
    goal: input.goal,
    audience: "your ideal customer",
    channel: mapLegacyChannel(input.channel),
    topic: input.topic,
  };

  switch (input.channel) {
    case "email": {
      const email = generateEmail(request);
      return { channel: input.channel, headline: email.subject, body: email.body, callToAction: email.callToAction };
    }
    case "ad_copy": {
      const ad = generateAdCopy(request);
      return { channel: input.channel, headline: ad.headline, body: ad.primaryText, callToAction: ad.callToAction };
    }
    case "social_post":
    case "caption":
    default: {
      const post = generateSocialPost(request);
      return { channel: input.channel, headline: post.headline, body: post.body, callToAction: post.callToAction };
    }
  }
}
