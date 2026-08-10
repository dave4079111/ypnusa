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

const employmentChips: FlowChip[] = [
  { label: "W-2 Employee", value: "w2" },
  { label: "Self-employed", value: "self" },
  { label: "Retired / fixed income", value: "retired" },
  { label: "Investor income", value: "investor" },
];

const propertyChips: FlowChip[] = [
  { label: "Single family", value: "single_family" },
  { label: "Condo / townhome", value: "attached" },
  { label: "2-4 unit", value: "small_multifamily" },
  { label: "5+ multifamily / commercial mix", value: "commercialish" },
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

const baseFlow: FlowStepDescriptor[] = [
  {
    id: "borrower_goal",
    prompt:
      "Let’s personalize this. Are you leaning toward purchasing a new property or refinancing an existing mortgage?",
    fieldPath: "purchaseRefiIntent",
    kind: "select",
    chips: intentChips,
    placeholder: "Select your goal",
  },
  {
    id: "property_type",
    prompt:
      "Describe the collateral you have in mind (we’ll tailor disclosures next).",
    fieldPath: "propertyType",
    kind: "select",
    chips: propertyChips,
    placeholder: "Select property profile",
    hint: "If you aren’t certain, pick what’s closest—we can refine later.",
  },
  {
    id: "credit_band",
    prompt:
      "What’s your best estimate for credit today? Bands help us benchmark without pulling a bureau yet.",
    fieldPath: "estimatedCreditBand",
    kind: "select",
    chips: creditChips,
    placeholder: "Choose a range",
  },
  {
    id: "employment",
    prompt: "How do you primarily earn qualifying income?",
    fieldPath: "employment",
    kind: "select",
    chips: employmentChips,
    placeholder: "Select employment type",
  },
  {
    id: "annual_income",
    prompt:
      "Rough annual income available for underwriting (USD). Use pre-tax totals you’re comfortable stating.",
    fieldPath: "annualIncomeUsd",
    kind: "number",
    placeholder: "e.g. 120000",
    hint: "Round to the nearest thousand if needed.",
  },
  {
    id: "timeline",
    prompt:
      "What timing best matches where you’re at? This fuels urgency cues for your YPN USA routing team.",
    fieldPath: "timeline",
    kind: "select",
    chips: timelineChips,
    placeholder: "Choose timing",
  },
  {
    id: "property_zip",
    prompt:
      "What 5-digit ZIP code is the property in, or where are you planning to purchase? This routes you to the correct exclusive local MLO.",
    fieldPath: "propertyZip",
    kind: "text",
    placeholder: "e.g. 93720",
    hint: "Use the property ZIP, not your current mailing ZIP.",
  },
  {
    id: "estimated_down_payment",
    prompt:
      "What down payment / equity infusion are you planning (USD estimate)? Tap $0 if refinancing and liquidity is the objective.",
    fieldPath: "estimatedDownPaymentUsd",
    kind: "number",
    placeholder: "e.g. 25000",
    when: (_loan, answers) => answers.purchaseRefiIntent === "purchase",
  },
];

const identityFlow: FlowStepDescriptor[] = [
  {
    id: "borrower_full_name",
    prompt: "What name should appear on disclosures and LOS handoffs?",
    fieldPath: "name",
    kind: "text",
    placeholder: "First & last name",
  },
  {
    id: "borrower_email",
    prompt: "Where can we securely send confirmations and disclosures?",
    fieldPath: "email",
    kind: "email",
    placeholder: "name@company.com",
  },
  {
    id: "borrower_phone",
    prompt: "What is the best mobile number for appointment updates?",
    fieldPath: "phone",
    kind: "tel",
    placeholder: "(555) 123-9876",
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

export const programPrefaces: Record<LoanProgram, FlowStepDescriptor[]> = {
  FHA: [
    {
      id: "fha_first_home",
      prompt: "Will this FHA loan be utilized for your first FHA-insured financing?",
      fieldPath: "firstTimeBuyer",
      kind: "boolean",
      chips: [
        { label: "First-time FHA borrower", value: "true" },
        { label: "Repeat FHA borrower", value: "false" },
      ],
    },
  ],
  VA: [
    {
      id: "va_eligibility",
      prompt:
        "Confirm service eligibility—we’ll prioritize VA purchase vs IRRRL coaching accordingly.",
      fieldPath: "veteranStatus",
      kind: "select",
      chips: [
        { label: "I’m VA eligible today", value: "yes" },
        { label: "Not veteran / civilian path", value: "no" },
        { label: "Need eligibility review", value: "unsure" },
      ],
    },
    {
      id: "va_coe",
      prompt:
        "Do you already have—or can quickly obtain—a Certificate of Eligibility?",
      fieldPath: "vaCertificateOfEligibility",
      kind: "select",
      chips: [
        { label: "COE ready", value: "yes" },
        { label: "Need help obtaining COE", value: "no" },
        { label: "Unsure—please audit", value: "unsure" },
      ],
    },
  ],
  CONVENTIONAL: [],
  DSCR: [
    {
      id: "dscr_portfolio_depth",
      prompt:
        "How many financed investment properties appear on your schedules today?",
      fieldPath: "portfolioPropertyCount",
      kind: "number",
      placeholder: "e.g. 3",
      hint: "Approximate financed units—even if scattered across lenders.",
    },
    {
      id: "dscr_rent_hypothesis",
      prompt:
        "What monthly market rent feels realistic for underwriting stress tests (USD)?",
      fieldPath: "expectedMonthlyRentUsd",
      kind: "number",
      placeholder: "e.g. 3100",
    },
  ],
  HELOC: [
    {
      id: "heloc_home_value",
      prompt: "What’s your best estimate for current residential value?",
      fieldPath: "estimatedHomeValueUsd",
      kind: "number",
      placeholder: "e.g. 540000",
    },
    {
      id: "heloc_payoff_balance",
      prompt: "Rough first-lien balance still outstanding?",
      fieldPath: "currentMortgageBalanceUsd",
      kind: "number",
      placeholder: "e.g. 310000",
    },
  ],
  REFI: [
    {
      id: "refi_current_rate",
      prompt:
        "What rate are you servicing today on the lien you want repriced?",
      fieldPath: "currentRatePct",
      kind: "number",
      placeholder: "e.g. 7.125",
      hint: "Include any temporary buydown—we’ll reconcile soon.",
    },
    {
      id: "refi_balance",
      prompt: "Outstanding balance we should model for payoff + savings math?",
      fieldPath: "currentLoanBalanceUsd",
      kind: "number",
      placeholder: "e.g. 412000",
    },
    {
      id: "refi_goal",
      prompt: "What outcome matters most?",
      fieldPath: "refinanceGoal",
      kind: "select",
      chips: [
        { label: "Lower payment / rate & term", value: "lower_payment" },
        { label: "Cash-out for reinvestment", value: "cash_out" },
        { label: "Remove MI / streamline path", value: "remove_mi" },
        { label: "Shorten amortization horizon", value: "shorten_term" },
      ],
      placeholder: "Choose primary outcome",
    },
  ],
  JUMBO: [
    {
      id: "jumbo_target_amount",
      prompt: "What super-conforming financing amount are we targeting?",
      fieldPath: "targetLoanAmountUsd",
      kind: "number",
      placeholder: "e.g. 1250000",
    },
    {
      id: "jumbo_reserve_depth",
      prompt: "How much liquid reserves are immediately deployable?",
      fieldPath: "liquidAssetsUsd",
      kind: "number",
      placeholder: "e.g. 240000",
    },
  ],
};

export function composeFlow(loan: LoanProgram): FlowStepDescriptor[] {
  const preface = programPrefaces[loan];
  return [...preface, ...baseFlow, ...identityFlow];
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
  const flavor: Record<LoanProgram, string> = {
    FHA:
      "FHA playbook engaged—capture MI + residual income scaffolding while we personalize your underwriting path.",
    VA:
      "VA concierge mode—we will validate eligibility, IRRRL deltas, and COE checkpoints as we chat.",
    CONVENTIONAL:
      "Conventional lending mode—we will align credit, down payment, and timing with a practical approval path.",
    DSCR:
      "Rental-performance lens active—Debt Service Coverage underwriting starts with rents and portfolio breadth.",
    HELOC:
      "Equity choreography begins—tell me about property value stacks and payoff objectives.",
    REFI:
      "Refinance heatmap enabled—we will benchmark your current lien against LOS pricing ladders.",
    JUMBO:
      "White-glove jumbo strategist online—capturing supersized loan structuring + liquidity nuance.",
  };

  return `Hi there, I am the YPN USA ${program} intake assistant. ${flavor[program]} Ready when you are.`;
}
