/**
 * Google My Business post/description agent — stubbed pending an LLM/template
 * provider. coreAgent already routes "gmb.generate" here.
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

export async function generateGmbContent(_input: GmbAgentInput): Promise<GmbAgentOutput> {
  throw new Error("gmbAgent.generateGmbContent is not implemented yet.");
}
