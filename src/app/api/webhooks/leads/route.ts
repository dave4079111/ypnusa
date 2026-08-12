import { persistSession } from "@/lib/db";
import {
  isRecord,
  jsonError,
  jsonOk,
  parseJsonBody,
  requireConfiguredSecret,
} from "@/lib/http";
import { generateId } from "@/lib/id";
import { finalizeIntakeArtifacts } from "@/lib/intake-pipeline";
import { coerceLoanProgram } from "@/lib/programs";
import type { BorrowerAnswers, IntakeSessionRecord } from "@/lib/types";
import { optionalText } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InboundLeadPayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  loanProgram?: unknown;
  timeline?: unknown;
  estimatedCreditBand?: unknown;
  purchaseRefiIntent?: unknown;
  funnelSource?: unknown;
  contactConsent?: unknown;
}

export async function POST(request: Request) {
  const unauthorized = requireConfiguredSecret(request);
  if (unauthorized) return unauthorized;

  const parsed = await parseJsonBody<InboundLeadPayload>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
  if (!isRecord(parsed.data)) {
    return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }

  const program = coerceLoanProgram(parsed.data.loanProgram);
  const name = optionalText(parsed.data.name, 160);
  const email = optionalText(parsed.data.email, 320);
  const phone = optionalText(parsed.data.phone, 40);
  const timeline = optionalText(parsed.data.timeline, 40);
  const estimatedCreditBand = optionalText(parsed.data.estimatedCreditBand, 40);

  if (!program || !name || !email || !phone || !timeline || !estimatedCreditBand) {
    return jsonError(
      "name, email, phone, loanProgram, timeline, and estimatedCreditBand are required.",
      400,
      "INCOMPLETE_LEAD",
    );
  }

  const answers: BorrowerAnswers = {
    loanProgram: program,
    name,
    email,
    phone,
    timeline,
    estimatedCreditBand,
    purchaseRefiIntent:
      parsed.data.purchaseRefiIntent === "purchase" ||
      parsed.data.purchaseRefiIntent === "refinance" ||
      parsed.data.purchaseRefiIntent === "unsure"
        ? parsed.data.purchaseRefiIntent
        : "unsure",
    contactConsent: parsed.data.contactConsent === true,
    funnelSource: optionalText(parsed.data.funnelSource, 160) ?? "lead_webhook",
  };

  const session: IntakeSessionRecord = {
    id: generateId("sess"),
    createdAt: new Date().toISOString(),
    funnelSource: answers.funnelSource ?? "lead_webhook",
    loanProgram: program,
    answers,
    status: "qualified",
  };
  persistSession(session);

  const result = await finalizeIntakeArtifacts(session);
  if ("message" in result) {
    return jsonError(result.message, 422, "LEAD_FINALIZATION_FAILED");
  }

  return jsonOk(
    {
      borrowerLeadId: result.borrowerLeadId,
      crmLeadId: result.crmLeadId,
      assignedOfficer: result.assignedOfficer,
      qualification: result.qualification,
      followUpsQueued: result.followUpsQueued ?? 0,
      immediateOutreachSent: result.immediateOutreachSent ?? 0,
    },
    { status: 201 },
  );
}
