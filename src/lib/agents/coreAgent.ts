import { generateMarketingContent, type MarketingAgentInput } from "./marketingAgent";
import { generateGmbContent, type GmbAgentInput } from "./gmbAgent";
import { buildWebsitePage, type WebsiteBuilderInput } from "./websiteBuilderAgent";
import { suggestTerritory, scoreZip, explainZip } from "./zipLogicAgent";
import { scoreLead, type Lead, type ZipContext, type CountyEvents } from "./predictiveAgent";

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
  | { type: "zip-explain"; zip: string };

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
    }
  } catch (error) {
    return errorResult(task.type, error);
  }
}
