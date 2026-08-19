/**
 * Marketing & social copy agent — stubbed pending an LLM/template provider.
 * coreAgent already routes "marketing.generate" here, so wiring in real
 * generation later needs no dispatcher changes.
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

export async function generateMarketingContent(_input: MarketingAgentInput): Promise<MarketingAgentOutput> {
  throw new Error("marketingAgent.generateMarketingContent is not implemented yet.");
}
