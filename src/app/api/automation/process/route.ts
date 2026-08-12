import { processDueFollowUps } from "@/lib/automation";
import { jsonError, jsonOk, logApiError, requireConfiguredSecret } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const unauthorized = requireConfiguredSecret(request);
    if (unauthorized) return unauthorized;

    const limited = enforceRateLimit(request, {
      scope: "automation",
      limit: 10,
      message: "Too many automation runs — please slow down and try again shortly.",
    });
    if (limited) return limited;

    const summary = await processDueFollowUps();
    return jsonOk(summary);
  } catch (error) {
    logApiError("/api/automation/process", error);
    return jsonError("Automation processing failed.", 500, "AUTOMATION_PROCESS_FAILED");
  }
}
