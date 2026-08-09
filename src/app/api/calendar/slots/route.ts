import { listAvailableSlots } from "@/lib/calendar";
import { jsonError, jsonOk, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const loId = searchParams.get("loId")?.trim() || undefined;
    const horizon = Number(searchParams.get("horizon") ?? "12");
    const safeHorizon = Number.isFinite(horizon)
      ? Math.min(Math.max(Math.trunc(horizon), 1), 30)
      : 12;

    const slots = listAvailableSlots(loId, safeHorizon);
    return jsonOk({ slots });
  } catch (error) {
    logApiError("/api/calendar/slots", error);
    return jsonError("Calendar slots are temporarily unavailable.", 500, "CALENDAR_SLOTS_FAILED");
  }
}
