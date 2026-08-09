import { summarizeAnalyticsPulse } from "@/lib/analytics-core";
import { jsonError, jsonOk, logApiError, requireConfiguredSecret } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const unauthorized = requireConfiguredSecret(request);
    if (unauthorized) return unauthorized;

    return jsonOk({ analytics: summarizeAnalyticsPulse() });
  } catch (error) {
    logApiError("/api/analytics/summary", error);
    return jsonError("Analytics summary is temporarily unavailable.", 500, "ANALYTICS_SUMMARY_FAILED");
  }
}
