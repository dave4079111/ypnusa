import { summarizeAnalyticsPulse } from "@/lib/analytics-core";
import { requireSessionOrSecret } from "@/lib/auth";
import { jsonError, jsonOk, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const unauthorized = await requireSessionOrSecret(request);
    if (unauthorized) return unauthorized;

    return jsonOk({ analytics: summarizeAnalyticsPulse() });
  } catch (error) {
    logApiError("/api/analytics/summary", error);
    return jsonError("Analytics summary is temporarily unavailable.", 500, "ANALYTICS_SUMMARY_FAILED");
  }
}
