import { listSyncedAvailableSlots } from "@/lib/calendar";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = await distributedRateLimit(
      `calendar-slots:${clientKey(request)}`,
      60,
      60_000,
    );
    if (!limited.ok) {
      return jsonError("Too many calendar requests.", 429, "RATE_LIMITED", {
        headers: { "Retry-After": String(limited.retryAfter) },
      });
    }
    const { searchParams } = new URL(request.url);
    const loId = searchParams.get("loId")?.trim() || undefined;
    const horizon = Number(searchParams.get("horizon") ?? "12");
    const safeHorizon = Number.isFinite(horizon)
      ? Math.min(Math.max(Math.trunc(horizon), 1), 30)
      : 12;

    const slots = await listSyncedAvailableSlots(loId, safeHorizon);
    return jsonOk({ slots: slots.slice(0, 3) });
  } catch (error) {
    logApiError("/api/calendar/slots", error);
    return jsonError("Calendar slots are temporarily unavailable.", 500, "CALENDAR_SLOTS_FAILED");
  }
}
