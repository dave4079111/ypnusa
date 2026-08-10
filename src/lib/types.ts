import type { PricingTierId } from "./pricing";

export type LoanProgram =
  | "FHA"
  | "VA"
  | "CONVENTIONAL"
  | "DSCR"
  | "HELOC"
  | "REFI"
  | "JUMBO";

export type LeadQuality = "prime" | "strong" | "developing" | "watch";

export type Urgency = "critical" | "high" | "standard" | "low";

export type FollowUpPlan =
  | "immediate_confirmation_email"
  | "immediate_sms_ack"
  | "day_1_educational_email"
  | "day_3_book_call_email"
  | "day_5_urgency_email"
  | "day_30_check_in"
  | "day_60_check_in"
  | "day_90_check_in";

export type FollowUpChannel = "email" | "sms";
export type CalendarProvider = "local" | "google" | "microsoft" | "calendly";

export interface BorrowerAnswers {
  loanProgram: LoanProgram;
  name?: string;
  email?: string;
  phone?: string;
  contactConsent?: boolean;
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
  calendarProvider?: CalendarProvider;
  calendarId?: string;
  calendarTimeZone?: string;
  calendlyUrl?: string;
}

export interface MloSubscriberProfile {
  id: string;
  name: string;
  email: string;
  paidAccess: true;
  nmlsId?: string;
  company?: string;
  subscriptionTier?: string;
  claimedZips: string[];
}

export interface AuthSessionRecord {
  idHash: string;
  createdAt: string;
  expiresAt: string;
  profile: MloSubscriberProfile;
}

export interface ConsumedSsoTokenRecord {
  jtiHash: string;
  consumedAt: string;
  expiresAt: string;
}

export interface MloLeadSubmissionRecord {
  eventId: string;
  createdAt: string;
  mlo: MloSubscriberProfile;
  borrower: BorrowerAnswers;
  intakeSessionId: string;
  borrowerLeadId: string;
  crmLeadId: string;
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
  status: "pending" | "sending" | "sent" | "failed";
  bodySummary: string;
  createdAt: string;
  sentAt?: string;
  attemptCount?: number;
  deliveryProvider?: "twilio" | "sendgrid" | "webhook" | "demo";
  providerMessageId?: string;
  lastError?: string;
}

export interface AppointmentRecord {
  id: string;
  borrowerLeadId: string;
  loId: string;
  start: string;
  end: string;
  createdAt: string;
  borrowerNotes?: string;
  provider?: CalendarProvider;
  externalEventId?: string;
  meetingUrl?: string;
  externalBookingUrl?: string;
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
    | "followup_processed"
    | "demo_requested"
    | "property_evaluation_saved";
  createdAt: string;
  payload: Record<string, unknown>;
}

/** Loan-officer / brokerage territory reservation captured from the marketing site. */
export interface DemoRequestRecord {
  id: string;
  createdAt: string;
  name: string;
  workEmail: string;
  company: string;
  phone?: string;
  role?: string;
  /** Requested exclusive ZIP-code territory. */
  zip?: string;
  monthlyLeadVolume?: string;
  message?: string;
  source?: string;
  status: "new" | "contacted";
}

export interface PropertyEvaluationRecord {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone?: string;
  zip: string;
  estimatedHomeValueUsd: number;
  currentMortgageBalanceUsd: number;
  estimatedEquityUsd: number;
  illustrativeCashOutUsd: number;
  estimatedLtvPct: number;
  contactConsent: true;
  source: string;
  status: "new" | "contacted";
}

export interface RevenueSubscriptionRecord {
  id: string;
  createdAt: string;
  startedAt: string;
  tier: PricingTierId;
  status: "trialing" | "active" | "cancelled";
  source: "seed" | "demo_request" | "admin_adjustment";
  ownerLoId?: string;
  ownerEmail?: string;
  company?: string;
  claimedZips: string[];
  countyTerritories?: string[];
  monthlyPriceCents?: number;
  lifetimeMonths?: number;
  attributedDemoRequestIds?: string[];
}

export interface DbShape {
  loanOfficers: LoanOfficerRecord[];
  authSessions: AuthSessionRecord[];
  consumedSsoTokens: ConsumedSsoTokenRecord[];
  mloLeadSubmissions: MloLeadSubmissionRecord[];
  sessions: IntakeSessionRecord[];
  borrowerLeads: BorrowerLeadRecord[];
  crmLeads: CrmLeadRecord[];
  loAlerts: LoAlertRecord[];
  followUps: ScheduledFollowUpRecord[];
  appointments: AppointmentRecord[];
  analyticsEvents: AnalyticsEventRecord[];
  demoRequests: DemoRequestRecord[];
  propertyEvaluations: PropertyEvaluationRecord[];
  revenueSubscriptions: RevenueSubscriptionRecord[];
}
