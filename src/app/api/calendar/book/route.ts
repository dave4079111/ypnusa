import { NextResponse } from "next/server";
import { bookAppointment } from "@/lib/calendar";
import { appendAnalytics, readDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      borrowerLeadId?: string;
      loId?: string;
      startIso?: string;
      notes?: string;
    };

    if (!body.borrowerLeadId || !body.loId || !body.startIso) {
      return NextResponse.json(
        { ok: false, error: "borrowerLeadId, loId, and startIso are required." },
        { status: 400 },
      );
    }

    const db = readDb();
    const lead = db.borrowerLeads.find((item) => item.id === body.borrowerLeadId);
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found for booking." }, { status: 404 });
    }

    if (lead.assignedLoId !== body.loId) {
      return NextResponse.json(
        { ok: false, error: "Loan officer mismatch for this borrower." },
        { status: 409 },
      );
    }

    const appointment = bookAppointment({
      borrowerLeadId: body.borrowerLeadId,
      loId: body.loId,
      startIso: body.startIso,
      notes: body.notes,
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

    return NextResponse.json({ ok: true, appointment });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid booking payload." }, { status: 400 });
  }
}
