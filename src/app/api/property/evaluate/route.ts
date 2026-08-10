import { appendAnalytics, appendPropertyEvaluation } from "@/lib/db";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { generateId } from "@/lib/id";
import { calculatePropertyEquity } from "@/lib/property-equity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { PropertyEvaluationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}$/;

function text(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function amount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(value);
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
    if (!isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const body = parsed.data;
    const wantsContact = body.contactConsent === true;
    const limited = rateLimit(
      `property:${wantsContact ? "lead" : "estimate"}:${clientKey(request)}`,
      wantsContact ? 5 : 20,
      60_000,
    );
    if (!limited.ok) {
      return jsonError(
        "Too many requests — please wait before trying again.",
        429,
        "RATE_LIMITED",
        { headers: { "Retry-After": String(limited.retryAfter) } },
      );
    }

    const zip = text(body.zip, 5);
    const estimatedHomeValueUsd = amount(body.estimatedHomeValueUsd);
    const currentMortgageBalanceUsd = amount(body.currentMortgageBalanceUsd);

    if (!zip || !ZIP_RE.test(zip)) {
      return jsonError("Enter a valid 5-digit ZIP code.", 400, "INVALID_ZIP");
    }
    if (
      estimatedHomeValueUsd === undefined ||
      estimatedHomeValueUsd < 10_000 ||
      estimatedHomeValueUsd > 10_000_000
    ) {
      return jsonError(
        "Estimated home value must be between $10,000 and $10,000,000.",
        400,
        "INVALID_HOME_VALUE",
      );
    }
    if (
      currentMortgageBalanceUsd === undefined ||
      currentMortgageBalanceUsd < 0 ||
      currentMortgageBalanceUsd > 20_000_000
    ) {
      return jsonError(
        "Current mortgage balance must be between $0 and $20,000,000.",
        400,
        "INVALID_MORTGAGE_BALANCE",
      );
    }

    const snapshot = calculatePropertyEquity({
      estimatedHomeValueUsd,
      currentMortgageBalanceUsd,
    });
    let evaluationId: string | undefined;

    if (wantsContact) {
      const name = text(body.name, 120);
      const email = text(body.email, 320);
      const phone = text(body.phone, 40);
      if (!name || !email) {
        return jsonError(
          "Name and email are required to request an MLO review.",
          400,
          "MISSING_CONTACT",
        );
      }
      if (!EMAIL_RE.test(email)) {
        return jsonError("Enter a valid email address.", 400, "INVALID_EMAIL");
      }

      const record: PropertyEvaluationRecord = {
        id: generateId("equity"),
        createdAt: new Date().toISOString(),
        name,
        email,
        phone,
        zip,
        ...snapshot,
        contactConsent: true,
        source: text(body.source, 80) ?? "equity_snapshot",
        status: "new",
      };
      appendPropertyEvaluation(record);
      appendAnalytics({
        type: "property_evaluation_saved",
        payload: {
          propertyEvaluationId: record.id,
          zip: record.zip,
          estimatedLtvPct: record.estimatedLtvPct,
        },
      });
      evaluationId = record.id;
    }

    return jsonOk({
      snapshot,
      saved: Boolean(evaluationId),
      evaluationId,
      disclaimer:
        "Illustrative estimate based only on values you entered. It is not an appraisal, credit decision, commitment to lend, or offer of specific loan terms.",
    });
  } catch (error) {
    logApiError("/api/property/evaluate", error);
    return jsonError(
      "The equity snapshot could not be calculated.",
      500,
      "PROPERTY_EVALUATION_FAILED",
    );
  }
}
