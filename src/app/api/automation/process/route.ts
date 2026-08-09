import { processDueFollowUps } from "@/lib/automation";
import { jsonError, jsonOk, logApiError, requireConfiguredSecret } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const unauthorized = requireConfiguredSecret(request);
    if (unauthorized) return unauthorized;

    const limited = rateLimit(`automation:${clientKey(request)}`, 10, 60_000);
    if (!limited.ok) {
      return jsonError(
        "Too many automation runs — please slow down and try again shortly.",
        429,
        "RATE_LIMITED",
        { headers: { "Retry-After": String(limited.retryAfter) } },
      );
    }

    const summary = await processDueFollowUps();
    return jsonOk(summary);
  } catch (error) {
    logApiError("/api/automation/process", error);
    return jsonError("Automation processing failed.", 500, "AUTOMATION_PROCESS_FAILED");
  }
}
