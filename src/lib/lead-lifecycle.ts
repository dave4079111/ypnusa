import type { IntakeSessionRecord, ScheduledFollowUpRecord } from "./types";
import type { LeadLifecycleStage, LeadState } from "./agent-types";

export interface LeadLifecycleInput {
  session?: IntakeSessionRecord;
  followUps?: ScheduledFollowUpRecord[];
  hasAppointment?: boolean;
  applicationStarted?: boolean;
  processingStarted?: boolean;
  closed?: boolean;
  lost?: boolean;
  now?: Date;
}

/**
 * Derive lifecycle state from durable facts. No AI decision is involved here.
 * Keeping this deterministic makes it safe to run repeatedly from jobs/webhooks.
 */
export function deriveLeadLifecycle(input: LeadLifecycleInput): LeadLifecycleStage {
  if (input.closed) return "closed";
  if (input.lost) return "lost";
  if (input.processingStarted) return "processing";
  if (input.applicationStarted) return "application";
  if (input.hasAppointment) return "appointment_booked";

  const session = input.session;
  if (!session) return "anonymous";

  if (session.status === "collecting") {
    const answerCount = Object.keys(session.answers ?? {}).filter(
      (key) => key !== "loanProgram" && session.answers[key as keyof typeof session.answers] !== undefined,
    ).length;
    return answerCount > 0 ? "qualifying" : "engaged";
  }

  if (session.status === "qualified") return "qualified";
  if (session.status === "crm_synced") {
    const pending = (input.followUps ?? []).some((item) => item.status === "pending");
    return pending ? "contacting" : "routed";
  }

  return "engaged";
}

export function buildLeadState(
  input: LeadLifecycleInput & Pick<LeadState, "answers" | "recentFollowUps" | "currentObjective">,
): LeadState {
  const now = input.now ?? new Date();
  return {
    leadId: input.session?.borrowerLeadId,
    sessionId: input.session?.id,
    lifecycle: deriveLeadLifecycle(input),
    answers: input.answers,
    qualification: undefined,
    assignedOfficer: undefined,
    crmLead: undefined,
    recentFollowUps: input.recentFollowUps,
    currentObjective: input.currentObjective,
    updatedAt: now.toISOString(),
  };
}
