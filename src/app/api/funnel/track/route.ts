import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents/coreAgent";
import type { FunnelStage } from "@/lib/funnel/stageTracker";
import { isRecord, jsonError, parseJsonBody, logApiError } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STAGES = new Set<FunnelStage>([
  "viewed_borrower_page",
  "clicked_cta",
  "started_signup",
  "completed_signup",
  "viewed_dashboard",
  "requested_insights",
]);

/**
 * Public — fires from anonymous visitors on the homepage/borrower funnel
 * (viewed page, clicked CTA, etc.), same reasoning as /api/personalize and
 * /api/cta. Rate-limited since it's an unauthenticated write endpoint.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`funnel-track:${clientKey(request)}`, 60, 60_000);
  if (!limited.ok) {
    return jsonError("Too many requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);

  const body = parsed.data;
  if (!isRecord(body) || typeof body.leadIdOrAnonId !== "string" || !body.leadIdOrAnonId.trim()) {
    return jsonError("Body must include { leadIdOrAnonId }.", 400, "INVALID_BODY");
  }

  const id = body.leadIdOrAnonId.trim().slice(0, 200);
  const stage = typeof body.stage === "string" && VALID_STAGES.has(body.stage as FunnelStage)
    ? (body.stage as FunnelStage)
    : undefined;
  const ctaLabel = typeof body.ctaLabel === "string" ? body.ctaLabel.trim().slice(0, 200) : undefined;

  if (!stage && !ctaLabel) {
    return jsonError("Body must include a valid { stage } or a non-empty { ctaLabel }.", 400, "INVALID_BODY");
  }

  try {
    const result = await runAgent({ type: "track-stage", id, stage, ctaLabel: ctaLabel || undefined });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    logApiError("/api/funnel/track", error);
    return jsonError("Funnel tracking is temporarily unavailable.", 500, "FUNNEL_TRACK_FAILED");
  }
}
