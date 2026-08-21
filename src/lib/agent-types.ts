import type {
  BorrowerAnswers,
  BorrowerLeadRecord,
  CrmLeadRecord,
  FollowUpChannel,
  FollowUpPlan,
  LoanOfficerRecord,
  QualificationSummary,
  ScheduledFollowUpRecord,
} from "./types";
import type { OutcomeSignals } from "./predictive/outcomeEngine";

/**
 * Persistent state the agent uses to manage a lead after intake.
 * This is intentionally separate from the intake questionnaire state.
 */
export type LeadLifecycleStage =
  | "anonymous"
  | "engaged"
  | "qualifying"
  | "qualified"
  | "routed"
  | "contacting"
  | "appointment_pending"
  | "appointment_booked"
  | "application"
  | "processing"
  | "closed"
  | "nurture"
  | "unresponsive"
  | "reengage"
  | "escalated"
  | "lost";

export type AgentActionKind =
  | "ask_question"
  | "clarify_answer"
  | "qualify_lead"
  | "route_lead"
  | "send_email"
  | "send_sms"
  | "create_followup"
  | "cancel_followups"
  | "book_appointment"
  | "add_crm_note"
  | "alert_mlo"
  | "escalate_to_mlo"
  | "wait";

export interface LeadState {
  leadId?: string;
  sessionId?: string;
  lifecycle: LeadLifecycleStage;
  answers: BorrowerAnswers;
  qualification?: QualificationSummary;
  assignedOfficer?: LoanOfficerRecord;
  crmLead?: CrmLeadRecord;
  recentFollowUps: ScheduledFollowUpRecord[];
  currentObjective: string;
  nextAction?: AgentAction;
  updatedAt: string;
}

export interface AgentAction {
  id: string;
  kind: AgentActionKind;
  reason: string;
  requiresConsent?: boolean;
  requiresHumanApproval?: boolean;
  payload: Record<string, unknown>;
}

export interface AgentActionResult {
  ok: boolean;
  actionId: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentContext {
  state: LeadState;
  borrowerLead?: BorrowerLeadRecord;
  now?: Date;
  /** Optional ZIP/county predictive signal (src/lib/agents/predictiveAgent.ts + predictive/outcomeEngine.ts). */
  predictiveSignal?: {
    leadScore: number;
    lifeEventLikelihood: number;
    outcomeSignals?: OutcomeSignals;
  };
}

export type AgentActionExecutor = (
  action: AgentAction,
  context: AgentContext,
) => Promise<AgentActionResult>;

export type FollowUpActionInput = {
  plan: FollowUpPlan;
  channel: FollowUpChannel;
  recipient: string;
};
