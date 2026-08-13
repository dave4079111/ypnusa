import type {
  AgentAction,
  AgentActionExecutor,
  AgentActionResult,
  AgentContext,
} from "./agent-types";

export interface AgentActionPolicy {
  /** Actions that may execute without a human approval gate. */
  autonomous: Set<AgentAction["kind"]>;
  /** Actions that must have explicit borrower consent. */
  consentRequired: Set<AgentAction["kind"]>;
}

export const DEFAULT_AGENT_ACTION_POLICY: AgentActionPolicy = {
  autonomous: new Set([
    "ask_question",
    "clarify_answer",
    "qualify_lead",
    "route_lead",
    "send_email",
    "send_sms",
    "create_followup",
    "cancel_followups",
    "book_appointment",
    "add_crm_note",
    "alert_mlo",
    "wait",
  ]),
  consentRequired: new Set(["send_email", "send_sms", "book_appointment"]),
};

export function validateAgentAction(
  action: AgentAction,
  context: AgentContext,
  policy: AgentActionPolicy = DEFAULT_AGENT_ACTION_POLICY,
): string | null {
  if (!policy.autonomous.has(action.kind)) {
    return action.requiresHumanApproval
      ? "Human approval is required for this action."
      : "This agent action is not enabled by policy.";
  }

  if (policy.consentRequired.has(action.kind)) {
    if (context.state.answers.contactConsent !== true) {
      return "Borrower contact consent is required before outreach or booking.";
    }
  }

  if (action.kind === "route_lead" && !context.state.qualification) {
    return "A lead must be qualified before routing.";
  }

  return null;
}

/**
 * Executes one action through a supplied adapter. The agent never receives
 * direct database/provider access; adapters own those integrations.
 */
export async function executeAgentAction(
  action: AgentAction,
  context: AgentContext,
  executor: AgentActionExecutor,
  policy: AgentActionPolicy = DEFAULT_AGENT_ACTION_POLICY,
): Promise<AgentActionResult> {
  const validationError = validateAgentAction(action, context, policy);
  if (validationError) {
    return {
      ok: false,
      actionId: action.id,
      message: validationError,
    };
  }

  try {
    return await executor(action, context);
  } catch (error) {
    console.error("[agent-actions] action execution failed", {
      actionId: action.id,
      kind: action.kind,
      error,
    });

    return {
      ok: false,
      actionId: action.id,
      message: "The requested agent action could not be completed.",
    };
  }
}
