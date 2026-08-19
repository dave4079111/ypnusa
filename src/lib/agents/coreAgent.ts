import {
  generateMarketingContent,
  generateSocialPost,
  generateEmail,
  generateAdCopy,
  type MarketingAgentInput,
  type MarketingRequest,
} from "./marketingAgent";
import {
  generateGmbContent,
  generateGMBPost,
  optimizeDescription,
  type GmbAgentInput,
  type GmbProfile,
  type GmbGoal,
} from "./gmbAgent";
import {
  buildWebsitePage,
  buildPageSpec,
  buildLandingPage,
  type WebsiteBuilderInput,
} from "./websiteBuilderAgent";
import { suggestTerritory, scoreZip, explainZip } from "./zipLogicAgent";
import { scoreLead, type Lead, type ZipContext, type CountyEvents } from "./predictiveAgent";
import { buildZipContext } from "./zipContext";
import { buildCountyEvents } from "./countyEvents";

/**
 * Central dispatcher ("brain shell") for the platform's task-oriented
 * sub-agents. Pure TypeScript, no framework code — callers submit an
 * AgentTask and get back a structured AgentResult. This is the only module
 * callers should import from src/lib/agents/.
 */

export type AgentTask =
  | { type: "predict-lead"; lead: Lead; zipContext: ZipContext; countyEvents: CountyEvents }
  | { type: "marketing-generate"; input: MarketingAgentInput }
  | { type: "gmb-generate"; input: GmbAgentInput }
  | { type: "website-build-page"; input: WebsiteBuilderInput }
  | { type: "zip-suggest-territory"; zip: string }
  | { type: "zip-score"; zip: string }
  | { type: "zip-explain"; zip: string }
  | { type: "marketing-social-post"; request: MarketingRequest }
  | { type: "marketing-email"; request: MarketingRequest }
  | { type: "marketing-ad-copy"; request: MarketingRequest }
  | { type: "gmb-post"; profile: GmbProfile; goal: GmbGoal }
  | { type: "gmb-optimize-description"; profile: GmbProfile }
  | { type: "website-page-spec"; goal: string; audience: string; sections: string[] }
  | { type: "website-landing-page"; goal: string; offer: string };

export type AgentTaskType = AgentTask["type"];

export interface AgentResult<TData = unknown> {
  ok: boolean;
  type: AgentTaskType;
  data?: TData;
  error?: string;
}

function okResult<T>(type: AgentTaskType, data: T): AgentResult<T> {
  return { ok: true, type, data };
}

function errorResult(type: AgentTaskType, error: unknown): AgentResult {
  return { ok: false, type, error: error instanceof Error ? error.message : String(error) };
}

export async function runAgent(task: AgentTask): Promise<AgentResult> {
  try {
    switch (task.type) {
      case "predict-lead":
        return okResult(task.type, scoreLead(task.lead, task.zipContext, task.countyEvents));
      case "marketing-generate":
        return okResult(task.type, await generateMarketingContent(task.input));
      case "gmb-generate":
        return okResult(task.type, await generateGmbContent(task.input));
      case "website-build-page":
        return okResult(task.type, await buildWebsitePage(task.input));
      case "zip-suggest-territory":
        return okResult(task.type, await suggestTerritory(task.zip));
      case "zip-score":
        return okResult(task.type, await scoreZip(task.zip));
      case "zip-explain":
        return okResult(task.type, await explainZip(task.zip));
      case "marketing-social-post":
        return okResult(task.type, generateSocialPost(task.request));
      case "marketing-email":
        return okResult(task.type, generateEmail(task.request));
      case "marketing-ad-copy":
        return okResult(task.type, generateAdCopy(task.request));
      case "gmb-post":
        return okResult(task.type, generateGMBPost(task.profile, task.goal));
      case "gmb-optimize-description":
        return okResult(task.type, optimizeDescription(task.profile));
      case "website-page-spec":
        return okResult(task.type, buildPageSpec(task.goal, task.audience, task.sections));
      case "website-landing-page":
        return okResult(task.type, buildLandingPage(task.goal, task.offer));
    }
  } catch (error) {
    return errorResult(task.type, error);
  }
}

/**
 * Convenience entry point for "predict-lead": builds ZipContext and
 * CountyEvents from live data sources (zipContext.ts, countyEvents.ts) so
 * callers only need a Lead and a ZIP, then runs the task through the same
 * runAgent() dispatcher above.
 */
export async function runPredictLeadForZip(lead: Lead, zip: string): Promise<AgentResult> {
  const zipContext = await buildZipContext(zip);
  const countyEvents = await buildCountyEvents(zipContext.county);
  return runAgent({ type: "predict-lead", lead, zipContext, countyEvents });
}
