import { bookAppointment } from "@/lib/calendar";
import { appendAnalytics, readDb } from "@/lib/db";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function optionalString(value: unknown, max: number): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, max) ?? undefined;
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit(`calendar-book:${clientKey(request)}`, 10, 60_000);
    if (!limited.ok) {
      return jsonError(
        "Too many booking attempts — please slow down and try again shortly.",
        429,
        "RATE_LIMITED",
        { headers: { "Retry-After": String(limited.retryAfter) } },
      );
    }

    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400, parsed.code);
    }

    if (!isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const borrowerLeadId = requiredString(parsed.data.borrowerLeadId, 160);
    const loId = requiredString(parsed.data.loId, 160);
    const startIso = requiredString(parsed.data.startIso, 80);

    if (!borrowerLeadId || !loId || !startIso) {
      return jsonError(
        "borrowerLeadId, loId, and startIso are required.",
        400,
        "MISSING_BOOKING_FIELDS",
      );
    }

    const startMs = Date.parse(startIso);
    if (!Number.isFinite(startMs)) {
      return jsonError("startIso must be a valid ISO timestamp.", 400, "INVALID_START");
    }

    const db = readDb();
    const lead = db.borrowerLeads.find((item) => item.id === borrowerLeadId);
    if (!lead) {
      return jsonError("Lead not found for booking.", 404, "LEAD_NOT_FOUND");
    }

    if (lead.assignedLoId !== loId) {
      return jsonError("Loan officer mismatch for this borrower.", 409, "LOAN_OFFICER_MISMATCH");
    }

    const appointment = bookAppointment({
      borrowerLeadId,
      loId,
      startIso: new Date(startMs).toISOString(),
      notes: optionalString(parsed.data.notes, 1000),
    });

    appendAnalytics({
      type: "appointment_booked",
      payload: {
        appointmentId: appointment.id,
        borrowerLeadId: appointment.borrowerLeadId,
        loId: appointment.loId,
        start: appointment.start,
      },
    });

    return jsonOk({ appointment });
  } catch (error) {
    logApiError("/api/calendar/book", error);
    return jsonError("Booking could not be completed.", 500, "BOOKING_FAILED");
  }
}
