import type { Pattern } from "@/lib/agents/contentAgent";
import { recommendForPattern } from "./siloBuilder";
import { buildPageSpec, type PageSpec } from "@/lib/agents/websiteBuilderAgent";
import {
  generateEmail,
  generateSocialPost,
  type EmailResult,
  type SocialPostResult,
  type MarketingRequest,
} from "@/lib/agents/marketingAgent";
import { generateGMBPost, type GmbPostResult, type GmbProfile } from "@/lib/agents/gmbAgent";

/**
 * Converts a single content Pattern into a full funnel: landing page JSON
 * (websiteBuilderAgent), a short email sequence and social posts
 * (marketingAgent), an optional GMB post (gmbAgent), and CTA blocks pulled
 * from the source content. Pure composition over the existing agents — no
 * new generation logic lives here.
 */

export interface CtaBlock {
  label: string;
  url?: string;
  context: string;
}

export interface FunnelOutput {
  pattern: Pattern;
  funnelType: string;
  landingPage: PageSpec;
  emailSequence: EmailResult[];
  socialPosts: SocialPostResult[];
  gmbPost: GmbPostResult | null;
  ctaBlocks: CtaBlock[];
}

const EMAIL_SEQUENCE_STEPS = ["Introduce the topic", "Go deeper with proof", "Make the ask"];
const SOCIAL_CHANNELS = ["facebook", "instagram", "linkedin"] as const;

function ctaBlocksFrom(pattern: Pattern): CtaBlock[] {
  if (pattern.ctas.length > 0) {
    return pattern.ctas.map((cta) => ({ label: cta.label, url: cta.url, context: pattern.title }));
  }
  return [{ label: "Get started today.", context: pattern.title }];
}

export function buildFunnel(
  pattern: Pattern,
  brandVoice: string,
  audience: string,
  gmbProfile?: GmbProfile,
): FunnelOutput {
  const recommendation = recommendForPattern(pattern);
  const landingPage = buildPageSpec(pattern.title, audience, recommendation.landingPageSections);

  const baseRequest: MarketingRequest = {
    brandVoice,
    goal: pattern.title,
    audience,
    channel: "email",
    topic: pattern.sections[0]?.heading ?? pattern.title,
  };

  const emailSequence = EMAIL_SEQUENCE_STEPS.map((step) =>
    generateEmail({ ...baseRequest, goal: `${pattern.title} — ${step}` }),
  );

  const socialPosts = SOCIAL_CHANNELS.map((channel) => generateSocialPost({ ...baseRequest, channel }));

  const gmbPost = gmbProfile ? generateGMBPost(gmbProfile, "announcement") : null;

  return {
    pattern,
    funnelType: recommendation.funnelType,
    landingPage,
    emailSequence,
    socialPosts,
    gmbPost,
    ctaBlocks: ctaBlocksFrom(pattern),
  };
}
