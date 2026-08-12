import { appendAnalytics, appendPropertyEvaluation } from "@/lib/db";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { generateId } from "@/lib/id";
import { calculatePropertyEquity } from "@/lib/property-equity";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isValidZip } from "@/lib/territory";
import type { PropertyEvaluationRecord } from "@/lib/types";
import { isValidEmail, optionalText, roundedAmount } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
    if (!isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const body = parsed.data;
    const wantsContact = body.contactConsent === true;
    const limited = enforceRateLimit(request, {
      scope: `property:${wantsContact ? "lead" : "estimate"}`,
      limit: wantsContact ? 5 : 20,
      message: "Too many requests — please wait before trying again.",
    });
    if (limited) return limited;

    const zip = optionalText(body.zip, 5);
    const estimatedHomeValueUsd = roundedAmount(body.estimatedHomeValueUsd);
    const currentMortgageBalanceUsd = roundedAmount(body.currentMortgageBalanceUsd);

    if (!zip || !isValidZip(zip)) {
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
      const name = optionalText(body.name, 120);
      const email = optionalText(body.email, 320);
      const phone = optionalText(body.phone, 40);
      if (!name || !email) {
        return jsonError(
          "Name and email are required to request an MLO review.",
          400,
          "MISSING_CONTACT",
        );
      }
      if (!isValidEmail(email)) {
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
        source: optionalText(body.source, 80) ?? "equity_snapshot",
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
