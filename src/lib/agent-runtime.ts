import type {
  AgentAction,
  AgentActionExecutor,
  AgentActionResult,
  AgentContext,
  LeadState,
} from "./agent-types";
import { executeAgentAction } from "./agent-actions";
import { decideNextAction } from "./next-best-action";

export interface AgentTurnResult {
  action: AgentAction;
  result?: AgentActionResult;
}

export type AgentTurnOptions = Pick<AgentContext, "borrowerLead" | "predictiveSignal" | "now">;

/**
 * Single orchestration boundary for the future LLM agent.
 * Today the decision is deterministic; later an intent/model adapter can
 * replace decideNextAction without changing action execution or policy gates.
 */
export function planAgentTurn(state: LeadState, options?: AgentTurnOptions): AgentAction {
  return decideNextAction({ state, ...options });
}

export async function runAgentTurn(
  state: LeadState,
  executor: AgentActionExecutor,
  options?: AgentTurnOptions,
): Promise<AgentTurnResult> {
  const context: AgentContext = { state, ...options };
  const action = planAgentTurn(state, options);
  const result = await executeAgentAction(action, context, executor);
  return { action, result };
}
