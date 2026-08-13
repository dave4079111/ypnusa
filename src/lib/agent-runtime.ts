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

/**
 * Single orchestration boundary for the future LLM agent.
 * Today the decision is deterministic; later an intent/model adapter can
 * replace decideNextAction without changing action execution or policy gates.
 */
export function planAgentTurn(state: LeadState): AgentAction {
  return decideNextAction({ state });
}

export async function runAgentTurn(
  state: LeadState,
  executor: AgentActionExecutor,
): Promise<AgentTurnResult> {
  const context: AgentContext = { state };
  const action = planAgentTurn(state);
  const result = await executeAgentAction(action, context, executor);
  return { action, result };
}
