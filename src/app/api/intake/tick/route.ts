import { NextResponse } from "next/server";
import type { IntakeTickRequest } from "@/lib/intake-contracts";
import { intakeTick } from "@/lib/intake-engine";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isRecord, logApiError, parseJsonBody } from "@/lib/http";
import type { BorrowerAnswers } from "@/lib/types";
import { optionalText } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BORROWER_FIELDS = new Set<string>([
  "name",
  "email",
  "phone",
  "contactConsent",
  "estimatedCreditBand",
  "annualIncomeUsd",
  "employment",
  "veteranStatus",
  "propertyType",
  "purchaseRefiIntent",
  "timeline",
  "estimatedDownPaymentUsd",
  "firstTimeBuyer",
  "vaCertificateOfEligibility",
  "portfolioPropertyCount",
  "expectedMonthlyRentUsd",
  "estimatedHomeValueUsd",
  "currentMortgageBalanceUsd",
  "currentRatePct",
  "refinanceGoal",
  "currentLoanBalanceUsd",
  "targetLoanAmountUsd",
  "liquidAssetsUsd",
]);

function intakeFailure(error: string, status: number, code: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
      code,
      sessionId: "",
      phase: "collecting",
      progress: { pct: 0, completed: 0, totalApplicable: 0 },
      assistantMessage: error,
      answers: { loanProgram: "FHA" },
      loanProgram: "FHA" as const,
    },
    { status },
  );
}

function validateTickBody(data: unknown):
  | { ok: true; body: IntakeTickRequest }
  | { ok: false; error: string; code: string } {
  if (!isRecord(data)) {
    return { ok: false, error: "Request body must be a JSON object.", code: "INVALID_BODY" };
  }

  const loanProgram = optionalText(data.loanProgram, 20);
  if (!loanProgram) {
    return { ok: false, error: "loanProgram is required.", code: "MISSING_LOAN_PROGRAM" };
  }

  const body: IntakeTickRequest = {
    loanProgram,
    sessionId: optionalText(data.sessionId, 160),
    funnelSource: optionalText(data.funnelSource, 160),
  };

  if (data.incoming !== undefined) {
    if (!isRecord(data.incoming)) {
      return { ok: false, error: "incoming must be an object.", code: "INVALID_INCOMING" };
    }

    const field = optionalText(data.incoming.field, 80);
    if (!field || !BORROWER_FIELDS.has(field)) {
      return { ok: false, error: "incoming.field is not supported.", code: "INVALID_FIELD" };
    }

    if (typeof data.incoming.rawValue !== "string") {
      return { ok: false, error: "incoming.rawValue must be a string.", code: "INVALID_VALUE" };
    }

    body.incoming = {
      field: field as keyof BorrowerAnswers,
      rawValue: data.incoming.rawValue.slice(0, 4000),
    };
  }

  return { ok: true, body };
}

export async function POST(request: Request) {
  const limited = rateLimit(`intake:${clientKey(request)}`, 60, 60_000);
  if (!limited.ok) {
    return intakeFailure(
      "Too many intake updates — please slow down and try again shortly.",
      429,
      "RATE_LIMITED",
    );
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return intakeFailure(parsed.error, 400, parsed.code ?? "INVALID_JSON");
    }

    const validated = validateTickBody(parsed.data);
    if (!validated.ok) {
      return intakeFailure(validated.error, 400, validated.code);
    }

    const envelope = await intakeTick(validated.body);
    return NextResponse.json(envelope);
  } catch (error) {
    logApiError("/api/intake/tick", error);
    return intakeFailure("Intake update failed. Please retry.", 500, "INTAKE_TICK_FAILED");
  }
}
