import { buildCtaSet, type CtaContext } from "@/lib/cta/ctaEngine";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public — powers the anonymous homepage ZIP checker, not just the dashboard. Pure/cheap, no rate limit needed. */
export async function POST(request: Request) {
  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);

  const body = parsed.data;
  if (!isRecord(body)) {
    return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }

  try {
    const cta = buildCtaSet(body as unknown as CtaContext);
    return jsonOk({ cta });
  } catch (error) {
    logApiError("/api/cta", error);
    return jsonError("CTA generation is temporarily unavailable.", 500, "CTA_FAILED");
  }
}
