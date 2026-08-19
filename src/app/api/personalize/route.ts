import { buildZipContext } from "@/lib/agents/zipContext";
import { buildCountyEvents } from "@/lib/agents/countyEvents";
import { scoreLead, type Lead } from "@/lib/agents/predictiveAgent";
import { buildPersonalization } from "@/lib/personalization/personalizationEngine";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public — powers the anonymous homepage ZIP checker, not just the dashboard. */
export async function POST(request: Request) {
  const limited = rateLimit(`personalize:${clientKey(request)}`, 20, 60_000);
  if (!limited.ok) {
    return jsonError("Too many requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);

  const body = parsed.data;
  if (!isRecord(body) || typeof body.zip !== "string" || !body.zip.trim()) {
    return jsonError("Body must include { zip }.", 400, "INVALID_BODY");
  }

  try {
    const zipContext = await buildZipContext(body.zip.trim());
    const countyEvents = await buildCountyEvents(zipContext.county);
    const lead = isRecord(body.lead) ? (body.lead as unknown as Lead) : null;
    const predictive = lead ? scoreLead(lead, zipContext, countyEvents) : undefined;

    const personalization = buildPersonalization({ zipContext, countyEvents, predictive });
    return jsonOk({ zipContext, countyEvents, predictive: predictive ?? null, personalization });
  } catch (error) {
    logApiError("/api/personalize", error);
    return jsonError("Personalization is temporarily unavailable.", 500, "PERSONALIZE_FAILED");
  }
}
