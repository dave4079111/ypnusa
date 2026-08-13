import type { BorrowerAnswers, LoanProgram } from "./types";

export type InputKind =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "boolean";

export interface FlowChip {
  label: string;
  value: string;
}

export interface FlowStepDescriptor {
  id: string;
  prompt: string;
  fieldPath: keyof BorrowerAnswers;
  kind: InputKind;
  chips?: FlowChip[];
  placeholder?: string;
  /** Show only when predicate passes */
  when?: (loan: LoanProgram, answers: BorrowerAnswers) => boolean;
  hint?: string;
}

const creditChips: FlowChip[] = [
  { label: "Excellent (740+)", value: "740-850" },
  { label: "Good (670-739)", value: "670-739" },
  { label: "Fair (620-669)", value: "620-669" },
  { label: "Building (<620)", value: "580-619" },
  { label: "Prefer not to say", value: "unknown" },
];

const intentChips: FlowChip[] = [
  { label: "Purchase", value: "purchase" },
  { label: "Refinance", value: "refinance" },
  { label: "Not sure yet", value: "unsure" },
];

const timelineChips: FlowChip[] = [
  { label: "< 30 days", value: "lt_30" },
  { label: "1-3 months", value: "1_3_months" },
  { label: "3-6 months", value: "3_6_months" },
  { label: "Exploring research mode", value: "researching" },
];

/**
 * Production conversational flow.
 * Keep this intentionally short: one question at a time, with deeper
 * program/underwriting questions deferred until after the initial lead capture.
 */
const baseFlow: FlowStepDescriptor[] = [
  {
    id: "borrower_goal",
    prompt: "Are you looking to purchase a home or refinance an existing mortgage?",
    fieldPath: "purchaseRefiIntent",
    kind: "select",
    chips: intentChips,
    placeholder: "Select your goal",
  },
  {
    id: "target_amount",
    prompt: "About what home price or loan amount are you targeting?",
    fieldPath: "targetLoanAmountUsd",
    kind: "number",
    placeholder: "e.g. 500000",
    hint: "A rough estimate is fine.",
  },
  {
    id: "timeline",
    prompt: "When are you hoping to move forward?",
    fieldPath: "timeline",
    kind: "select",
    chips: timelineChips,
    placeholder: "Choose timing",
  },
  {
    id: "credit_band",
    prompt: "What is your approximate credit score range?",
    fieldPath: "estimatedCreditBand",
    kind: "select",
    chips: creditChips,
    placeholder: "Choose a range",
  },
  {
    id: "borrower_full_name",
    prompt: "Great. What is your full name?",
    fieldPath: "name",
    kind: "text",
    placeholder: "First & last name",
  },
  {
    id: "borrower_phone",
    prompt: "What is the best phone number to reach you?",
    fieldPath: "phone",
    kind: "tel",
    placeholder: "(555) 123-9876",
  },
  {
    id: "borrower_email",
    prompt: "And what is the best email address for your request?",
    fieldPath: "email",
    kind: "email",
    placeholder: "name@example.com",
  },
  {
    id: "contact_consent",
    prompt:
      "May YPN USA and your assigned loan officer contact you by text and email about this request? Message and data rates may apply; reply STOP to opt out.",
    fieldPath: "contactConsent",
    kind: "boolean",
    chips: [
      { label: "Yes, contact me", value: "true" },
      { label: "No, I’ll book here", value: "false" },
    ],
  },
];

/**
 * Program-specific qualification questions remain available for later use,
 * but are intentionally not inserted into the initial production intake.
 */
export const programPrefaces: Record<LoanProgram, FlowStepDescriptor[]> = {
  FHA: [],
  VA: [],
  CONVENTIONAL: [],
  DSCR: [],
  HELOC: [],
  REFI: [],
  JUMBO: [],
};

export function composeFlow(loan: LoanProgram): FlowStepDescriptor[] {
  return [...baseFlow];
}

export function isUnset(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export function estimateTotalSteps(loan: LoanProgram, answers: BorrowerAnswers): number {
  let count = 0;
  for (const step of composeFlow(loan)) {
    if (!step.when || step.when(loan, answers)) count += 1;
  }
  return Math.max(count, 1);
}

export function findNextStep(loan: LoanProgram, answers: BorrowerAnswers) {
  for (const step of composeFlow(loan)) {
    if (step.when && !step.when(loan, answers)) continue;
    const candidate = answers[step.fieldPath];
    if (isUnset(candidate)) {
      return step;
    }
  }
  return null;
}

export function summarizeFlowProgress(loan: LoanProgram, answers: BorrowerAnswers) {
  let totalApplicable = 0;
  let completed = 0;

  composeFlow(loan).forEach((step) => {
    if (step.when && !step.when(loan, answers)) return;
    totalApplicable += 1;
    if (!isUnset(answers[step.fieldPath])) {
      completed += 1;
    }
  });

  const pct =
    totalApplicable === 0 ? 0 : Math.round((completed / Math.max(totalApplicable, 1)) * 100);

  return {
    pct,
    completed,
    totalApplicable,
  };
}

export function greetingForProgram(program: LoanProgram): string {
  return `Hi there, I’m the YPN USA intake assistant. I’ll ask a few quick questions so we can understand what you’re looking for.`;
}
