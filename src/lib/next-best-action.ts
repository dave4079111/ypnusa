import { findNextStep } from "./flows";
import type { AgentAction, AgentContext } from "./agent-types";

function actionId(kind: AgentAction["kind"], seed: string): string {
  return `agent_${kind}_${seed}`;
}

/**
 * Deterministic first version of the agent decision layer.
 * An LLM can later supply richer intent/clarification decisions, but all
 * executable actions remain structured and policy-checkable.
 */
export function decideNextAction(context: AgentContext): AgentAction {
  const { state } = context;
  const seed = state.leadId ?? state.sessionId ?? "lead";

  if (state.lifecycle === "anonymous") {
    return {
      id: actionId("ask_question", seed),
      kind: "ask_question",
      reason: "No lead session exists yet.",
      payload: { target: "loan_program" },
    };
  }

  if (state.lifecycle === "engaged" || state.lifecycle === "qualifying") {
    const nextStep = findNextStep(state.answers.loanProgram, state.answers);
    if (nextStep) {
      return {
        id: actionId("ask_question", `${seed}_${nextStep.id}`),
        kind: "ask_question",
        reason: "The deterministic intake policy identifies a required unanswered field.",
        payload: {
          stepId: nextStep.id,
          field: nextStep.fieldPath,
          prompt: nextStep.prompt,
        },
      };
    }
  }

  if (state.lifecycle === "qualified") {
    return {
      id: actionId("route_lead", seed),
      kind: "route_lead",
      reason: "Qualification is complete and the lead has not yet been routed.",
      requiresHumanApproval: false,
      payload: { loanProgram: state.answers.loanProgram },
    };
  }

  if (state.lifecycle === "routed") {
    return {
      id: actionId("send_email", seed),
      kind: "send_email",
      reason: "A routed lead needs an immediate acknowledgment before longer nurture.",
      requiresConsent: true,
      payload: { template: "immediate_confirmation_email" },
    };
  }

  if (state.lifecycle === "contacting") {
    return {
      id: actionId("create_followup", seed),
      kind: "create_followup",
      reason: "The lead has active follow-up work and should remain in the agent's queue.",
      requiresConsent: true,
      payload: { policy: "next_due_followup" },
    };
  }

  if (state.lifecycle === "appointment_pending") {
    return {
      id: actionId("book_appointment", seed),
      kind: "book_appointment",
      reason: "The lead is ready for the scheduling rail.",
      requiresConsent: true,
      payload: { mode: "offer_slots" },
    };
  }

  if (state.lifecycle === "unresponsive" || state.lifecycle === "reengage") {
    return {
      id: actionId("send_sms", seed),
      kind: "send_sms",
      reason: "The lifecycle requires a re-engagement touch.",
      requiresConsent: true,
      payload: { template: "reengagement" },
    };
  }

  if (state.lifecycle === "escalated") {
    return {
      id: actionId("alert_mlo", seed),
      kind: "alert_mlo",
      reason: "The lead has been explicitly escalated to human handling.",
      requiresHumanApproval: false,
      payload: { urgency: "high" },
    };
  }

  return {
    id: actionId("wait", seed),
    kind: "wait",
    reason: "No autonomous action is currently justified by the durable lead state.",
    payload: {},
  };
}
