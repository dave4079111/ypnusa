import type {
  BorrowerAnswers,
  LoanProgram,
  QualificationSummary,
} from "./types";

export type IntakeAssistantInputKind =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "boolean";

export interface IntakeAssistantChip {
  label: string;
  value: string;
}

export interface AssistantStep {
  id: string;
  field: keyof BorrowerAnswers;
  prompt: string;
  placeholder?: string;
  hint?: string;
  kind: IntakeAssistantInputKind;
  chips?: IntakeAssistantChip[];
}

export interface IntakeTickRequest {
  sessionId?: string;
  loanProgram: LoanProgram | string;
  funnelSource?: string;
  incoming?: {
    field: keyof BorrowerAnswers;
    rawValue: string;
  };
}

export interface BorrowerFinalizeClientSnapshot {
  alreadyCompleted?: boolean;
  borrowerLeadId?: string;
  crmLeadId?: string;
  qualification?: QualificationSummary;
  assignedOfficer?: { id: string; name: string; email: string };
  routedPrograms?: LoanProgram[];
  followUpsQueued?: number;
  immediateOutreachSent?: number;
}

export interface IntakeTickResponse {
  ok: boolean;
  error?: string;
  sessionId: string;
  phase: "collecting" | "crm_synced";
  progress: {
    pct: number;
    completed: number;
    totalApplicable: number;
  };
  assistantMessage: string;
  answers: BorrowerAnswers;
  loanProgram: LoanProgram;
  activeStep?: AssistantStep | null;
  qualification?: QualificationSummary;
  crmArtifacts?: BorrowerFinalizeClientSnapshot;
  slotPreview?: Array<{ start: string; end: string; loId: string }>;
}
