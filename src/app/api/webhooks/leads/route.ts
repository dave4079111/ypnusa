import { timingSafeEqual } from "node:crypto";
import {
  claimMloLeadSubmission,
  completeMloLeadSubmission,
  persistSession,
  readDb,
  releaseMloLeadSubmission,
  upsertLoanOfficer,
} from "@/lib/db";
import {
  isRecord,
  jsonError,
  jsonOk,
  logApiError,
  parseJsonBody,
} from "@/lib/http";
import { generateId } from "@/lib/id";
import { finalizeIntakeArtifacts } from "@/lib/intake-pipeline";
import { coerceLoanProgram } from "@/lib/programs";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";
import type {
  BorrowerAnswers,
  IntakeSessionRecord,
  LoanOfficerRecord,
  LoanProgram,
  MloLeadProfile,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InboundLeadPayload {
  eventId?: unknown;
  mlo?: unknown;
  borrower?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  loanProgram?: unknown;
  timeline?: unknown;
  estimatedCreditBand?: unknown;
  purchaseRefiIntent?: unknown;
  funnelSource?: unknown;
  contactConsent?: unknown;
  propertyZip?: unknown;
  zip?: unknown;
}

const ALL_PROGRAMS: LoanProgram[] = [
  "FHA",
  "VA",
  "CONVENTIONAL",
  "DSCR",
  "HELOC",
  "REFI",
  "JUMBO",
];

function text(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function email(value: unknown): string | undefined {
  const normalized = text(value, 320)?.toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : undefined;
}

function phone(value: unknown): string | undefined {
  const normalized = text(value, 40)?.replace(/[^\d+(). -]/g, "");
  return normalized && normalized.replace(/\D/g, "").length >= 7 ? normalized : undefined;
}

function creditBand(value: unknown): string | undefined {
  const normalized = text(value, 40);
  if (normalized === "740+") return "740-850";
  return normalized === "740-850" ||
    normalized === "670-739" ||
    normalized === "620-669" ||
    normalized === "580-619" ||
    normalized === "unknown"
    ? normalized
    : undefined;
}

function isAuthorized(request: Request): "ok" | "missing" | "invalid" {
  const expected = process.env.MLO_LEAD_WEBHOOK_SECRET?.trim();
  if (!expected || Buffer.byteLength(expected) < 32) return "missing";
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const supplied = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : request.headers.get("x-webhook-secret")?.trim() ?? "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
    ? "ok"
    : "invalid";
}

function normalizeMlo(value: unknown): MloLeadProfile | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 160);
  const name = text(value.name, 160);
  const normalizedEmail = email(value.email);
  if (!id || !name || !normalizedEmail) return null;
  const claimedZips = Array.isArray(value.claimedZips)
    ? [...new Set(value.claimedZips)]
        .filter((zip): zip is string => typeof zip === "string")
        .map((zip) => zip.trim())
        .filter((zip) => /^\d{5}$/.test(zip))
        .slice(0, 500)
    : [];
  return {
    id,
    name,
    email: normalizedEmail,
    nmlsId: text(value.nmlsId, 40),
    company: text(value.company, 160),
    claimedZips,
  };
}

function normalizeBorrower(payload: InboundLeadPayload): BorrowerAnswers | null {
  const source = isRecord(payload.borrower) ? payload.borrower : payload;
  const loanProgram = coerceLoanProgram(source.loanProgram);
  const name = text(source.name, 160);
  const normalizedEmail = email(source.email);
  const normalizedPhone = phone(source.phone);
  const timeline =
    source.timeline === "lt_30" ||
    source.timeline === "1_3_months" ||
    source.timeline === "3_6_months" ||
    source.timeline === "researching"
      ? source.timeline
      : undefined;
  const estimatedCreditBand = creditBand(source.estimatedCreditBand);
  const propertyZip = text(source.propertyZip ?? source.zip, 5);
  if (
    !loanProgram ||
    !name ||
    !normalizedEmail ||
    !normalizedPhone ||
    !timeline ||
    !estimatedCreditBand ||
    !propertyZip ||
    !/^\d{5}$/.test(propertyZip) ||
    typeof source.contactConsent !== "boolean"
  ) {
    return null;
  }
  return {
    loanProgram,
    name,
    email: normalizedEmail,
    phone: normalizedPhone,
    timeline,
    estimatedCreditBand,
    propertyZip,
    purchaseRefiIntent:
      source.purchaseRefiIntent === "purchase" ||
      source.purchaseRefiIntent === "refinance" ||
      source.purchaseRefiIntent === "unsure"
        ? source.purchaseRefiIntent
        : "unsure",
    contactConsent: source.contactConsent,
    emailConsent: source.contactConsent,
    smsConsent: source.contactConsent,
    contactConsentAt: new Date().toISOString(),
    contactConsentSource: "mlo_webhook",
    contactConsentDisclosureVersion: "2026-08-10",
    funnelSource: text(source.funnelSource, 160) ?? "mlo_webform",
  };
}

function upsertWebhookMlo(profile: MloLeadProfile): LoanOfficerRecord {
  const existing = readDb().loanOfficers.find((officer) => officer.id === profile.id);
  const officer: LoanOfficerRecord = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    specialties: existing?.specialties ?? ALL_PROGRAMS,
    weeklyWindows:
      existing?.weeklyWindows ??
      [1, 2, 3, 4, 5].map((dow) => ({ dow, startMin: 9 * 60, endMin: 17 * 60 })),
    calendarProvider: existing?.calendarProvider,
    calendarId: existing?.calendarId,
    calendarTimeZone: existing?.calendarTimeZone,
    calendlyUrl: existing?.calendlyUrl,
  };
  upsertLoanOfficer(officer);
  return officer;
}

export async function POST(request: Request) {
  const limited = await distributedRateLimit(
    `lead-webhook:${clientKey(request)}`,
    60,
    60_000,
  );
  if (!limited.ok) {
    return jsonError("Too many webhook requests.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const authorization = isAuthorized(request);
  if (authorization === "missing") {
    return jsonError("Lead webhook is not configured.", 503, "WEBHOOK_NOT_CONFIGURED");
  }
  if (authorization === "invalid") {
    return jsonError("Unauthorized.", 401, "UNAUTHORIZED");
  }

  const parsed = await parseJsonBody<InboundLeadPayload>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
  if (!isRecord(parsed.data)) {
    return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }

  const eventId = text(parsed.data.eventId, 200);
  const mlo = normalizeMlo(parsed.data.mlo);
  const answers = normalizeBorrower(parsed.data);
  if (!eventId || !mlo || !answers) {
    return jsonError(
      "eventId, a valid MLO profile, and complete borrower data with explicit contactConsent are required.",
      400,
      "INCOMPLETE_LEAD",
    );
  }

  const snapshot = readDb();
  const entitlement = snapshot.revenueSubscriptions.find(
    (subscription) =>
      subscription.ownerLoId === mlo.id &&
      (subscription.status === "active" || subscription.status === "trialing"),
  );
  if (!entitlement) {
    return jsonError(
      "The assigned MLO does not have an active subscription.",
      403,
      "MLO_SUBSCRIPTION_REQUIRED",
    );
  }
  if (
    !answers.propertyZip ||
    !entitlement.claimedZips.includes(answers.propertyZip)
  ) {
    return jsonError(
      "The borrower ZIP is outside the MLO's active territories.",
      403,
      "MLO_TERRITORY_MISMATCH",
    );
  }

  const session: IntakeSessionRecord = {
    id: generateId("sess"),
    createdAt: new Date().toISOString(),
    funnelSource: answers.funnelSource ?? "lead_webhook",
    loanProgram: answers.loanProgram,
    answers,
    status: "qualified",
  };
  const existing = claimMloLeadSubmission({
    eventId,
    createdAt: new Date().toISOString(),
    status: "processing",
    mlo,
    borrower: answers,
    intakeSessionId: session.id,
  });
  if (existing?.status === "completed") {
    return jsonOk({
      duplicate: true,
      borrowerLeadId: existing.borrowerLeadId,
      crmLeadId: existing.crmLeadId,
    });
  }
  if (existing) {
    return jsonError("This lead event is already processing.", 409, "LEAD_IN_PROGRESS", {
      headers: { "Retry-After": "5" },
    });
  }

  try {
    const officer = upsertWebhookMlo(mlo);
    persistSession(session);
    const result = await finalizeIntakeArtifacts(session, { assignedLoId: officer.id });
    if ("message" in result || !result.borrowerLeadId || !result.crmLeadId) {
      releaseMloLeadSubmission(eventId);
      return jsonError(
        "message" in result ? result.message : "Lead finalization did not produce CRM records.",
        422,
        "LEAD_FINALIZATION_FAILED",
      );
    }
    completeMloLeadSubmission(eventId, result.borrowerLeadId, result.crmLeadId);

    return jsonOk(
      {
        duplicate: false,
        borrowerLeadId: result.borrowerLeadId,
        crmLeadId: result.crmLeadId,
        assignedOfficer: result.assignedOfficer,
        qualification: result.qualification,
        followUpsQueued: result.followUpsQueued ?? 0,
        immediateOutreachSent: result.immediateOutreachSent ?? 0,
        immediateOutreachFailed: result.immediateOutreachFailed ?? 0,
        externalMirrorDelivered: result.externalMirrorDelivered ?? false,
      },
      { status: 201 },
    );
  } catch (error) {
    releaseMloLeadSubmission(eventId);
    logApiError("/api/webhooks/leads", error);
    return jsonError("Unable to process lead.", 500, "LEAD_PROCESSING_FAILED");
  }
}
