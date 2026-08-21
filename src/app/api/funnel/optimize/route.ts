import { buildFunnel } from "@/lib/content/funnelBuilder";
import { buildCtaSet } from "@/lib/cta/ctaEngine";
import { buildPersonalization } from "@/lib/personalization/personalizationEngine";
import { buildZipContext } from "@/lib/agents/zipContext";
import { buildCountyEvents } from "@/lib/agents/countyEvents";
import type { Pattern } from "@/lib/agents/contentAgent";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { requireSessionOrSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optimizes a funnel: builds it (same as funnelBuilder.buildFunnel) and, when
 * a ZIP is supplied, enriches it with a personalization summary and CTA set
 * so a single call returns everything a landing surface needs to render.
 */
export async function POST(request: Request) {
  const unauthorized = await requireSessionOrSecret(request);
  if (unauthorized) return unauthorized;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);

  const body = parsed.data;
  if (!isRecord(body) || !isRecord(body.pattern)) {
    return jsonError("Body must include { pattern }.", 400, "INVALID_BODY");
  }

  const brandVoice = typeof body.brandVoice === "string" ? body.brandVoice : "warm and direct";
  const audience = typeof body.audience === "string" ? body.audience : "your ideal customer";
  const zip = typeof body.zip === "string" ? body.zip.trim() : "";

  try {
    const pattern = body.pattern as unknown as Pattern;
    const funnel = buildFunnel(pattern, brandVoice, audience);

    if (!zip) {
      const cta = buildCtaSet({ pattern, funnel });
      return jsonOk({ funnel, personalization: null, cta });
    }

    const zipContext = await buildZipContext(zip);
    const countyEvents = await buildCountyEvents(zipContext.county);
    const personalization = buildPersonalization({ zipContext, countyEvents });
    const cta = buildCtaSet({ zip, county: zipContext.county, pattern, funnel, personalization });

    return jsonOk({ funnel, personalization, cta });
  } catch (error) {
    logApiError("/api/funnel/optimize", error);
    return jsonError("Funnel optimization is temporarily unavailable.", 500, "FUNNEL_OPTIMIZE_FAILED");
  }
}
