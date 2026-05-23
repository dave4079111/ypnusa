export type LoanProgram = "FHA" | "VA" | "DSCR" | "HELOC" | "REFI" | "JUMBO";

export type LeadQuality = "prime" | "strong" | "developing" | "watch";

export type Urgency = "critical" | "high" | "standard" | "low";

export type FollowUpPlan =
  | "immediate_confirmation_email"
  | "immediate_sms_ack"
  | "day_1_educational_email"
  | "day_3_book_call_email"
  | "day_5_urgency_email";

export type FollowUpChannel = "email" | "sms";

export interface BorrowerAnswers {
  loanProgram: LoanProgram;
  name?: string;
  email?: string;
  phone?: string;
  /** e.g. 620-679, prefer numeric midpoint for scoring when possible */
  estimatedCreditBand?: string;
  annualIncomeUsd?: number;
  employment?: string;
  veteranStatus?: "yes" | "no" | "unsure";
  propertyType?: string;
  purchaseRefiIntent?: "purchase" | "refinance" | "unsure";
  timeline?: string;
  estimatedDownPaymentUsd?: number;
  /** FHA */
  firstTimeBuyer?: boolean;
  /** VA */
  vaCertificateOfEligibility?: "yes" | "no" | "unsure";
  /** DSCR */
  portfolioPropertyCount?: number;
  expectedMonthlyRentUsd?: number;
  /** HELOC */
  estimatedHomeValueUsd?: number;
  currentMortgageBalanceUsd?: number;
  /** Refi */
  currentRatePct?: number;
  refinanceGoal?: string;
  currentLoanBalanceUsd?: number;
  /** Jumbo */
  targetLoanAmountUsd?: number;
  liquidAssetsUsd?: number;
  /** funnel tag from marketing */
  funnelSource?: string;
}

export interface ProgramScores {
  fhaScore?: number;
  vaEligibilityScore?: number;
  investorProfileScore?: number;
  refiOpportunityScore?: number;
  overallScore?: number;
}

export interface QualificationSummary {
  programScores: ProgramScores;
  leadQuality: LeadQuality;
  urgency: Urgency;
  recommendedNextStep: string;
  rationale: string[];
}

export interface LoanOfficerRecord {
  id: string;
  name: string;
  email: string;
  specialties: LoanProgram[];
  /** Simple weekly availability placeholders (minutes from midnight UTC) */
  weeklyWindows: Array<{ dow: number; startMin: number; endMin: number }>;
}

export interface BorrowerLeadRecord {
  id: string;
  createdAt: string;
  funnelSource?: string;
  answers: BorrowerAnswers;
  qualification: QualificationSummary;
  assignedLoId: string;
  crmLeadId: string;
  sessionId?: string;
}

export interface CrmLeadRecord {
  id: string;
  createdAt: string;
  borrowerLeadId: string;
  funnelSource?: string;
  assignedLoId: string;
  status: string;
  notes: string[];
  qualificationSnapshot: QualificationSummary;
}

export interface LoAlertRecord {
  id: string;
  createdAt: string;
  loId: string;
  borrowerLeadId: string;
  loanProgram: LoanProgram;
  summary: string;
  qualificationSummary: QualificationSummary;
  suggestedAction: string;
  readAt?: string;
}

export interface ScheduledFollowUpRecord {
  id: string;
  borrowerLeadId: string;
  plan: FollowUpPlan;
  channel: FollowUpChannel;
  recipient: string;
  scheduledAt: string;
  status: "pending" | "sent" | "failed";
  bodySummary: string;
  createdAt: string;
  sentAt?: string;
}

export interface AppointmentRecord {
  id: string;
  borrowerLeadId: string;
  loId: string;
  start: string;
  end: string;
  createdAt: string;
  borrowerNotes?: string;
}

export interface IntakeSessionRecord {
  id: string;
  createdAt: string;
  funnelSource: string;
  loanProgram: LoanProgram;
  answers: BorrowerAnswers;
  status: "collecting" | "qualified" | "crm_synced";
  borrowerLeadId?: string;
  crmLeadId?: string;
}

export interface AnalyticsEventRecord {
  id: string;
  type:
    | "intake_started"
    | "intake_progress"
    | "intake_completed"
    | "appointment_booked"
    | "followup_processed";
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface DbShape {
  loanOfficers: LoanOfficerRecord[];
  sessions: IntakeSessionRecord[];
  borrowerLeads: BorrowerLeadRecord[];
  crmLeads: CrmLeadRecord[];
  loAlerts: LoAlertRecord[];
  followUps: ScheduledFollowUpRecord[];
  appointments: AppointmentRecord[];
  analyticsEvents: AnalyticsEventRecord[];
}
