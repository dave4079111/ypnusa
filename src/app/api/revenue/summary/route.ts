import { jsonError, jsonOk, logApiError, requireAdminOrBearer } from "@/lib/http";
import { summarizeRevenuePulse } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const unauthorized = requireAdminOrBearer(request);
    if (unauthorized) return unauthorized;
    return jsonOk({ data: summarizeRevenuePulse() });
  } catch (error) {
    logApiError("/api/revenue/summary", error);
    return jsonError("Revenue summary is temporarily unavailable.", 500, "REVENUE_SUMMARY_FAILED");
  }
}
