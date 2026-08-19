/**
 * Page-spec -> section JSON builder — stubbed pending an LLM/template
 * provider. coreAgent already routes "websiteBuilder.buildPage" here; once
 * implemented, existing Next.js components render from WebsiteBuilderOutput.
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

export async function buildWebsitePage(_input: WebsiteBuilderInput): Promise<WebsiteBuilderOutput> {
  throw new Error("websiteBuilderAgent.buildWebsitePage is not implemented yet.");
}
