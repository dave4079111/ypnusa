import { appendAppointment, readDb } from "./db";
import { generateId } from "./id";
import type { AppointmentRecord } from "./types";

const SLOT_DURATION_MIN = 30;

export interface CalendarSlotProposal {
  start: string;
  end: string;
  loId: string;
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Returns the next weekday dates (excluding today unless weekend bridge needed) */
export function collectBusinessAnchors(limit: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let safety = 0;
  while (days.length < limit && safety < 180) {
    safety += 1;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(utcDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function utcDateFromMinutes(day: Date, minutes: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, minutes, 0, 0),
  );
}

export function listAvailableSlots(loId?: string, horizonDays = 8): CalendarSlotProposal[] {
  const db = readDb();
  const roster = loId
    ? db.loanOfficers.filter((officer) => officer.id === loId)
    : db.loanOfficers;

  const occupancy = db.appointments.map((appointment) => ({
    officer: appointment.loId,
    start: new Date(appointment.start).getTime(),
    end: new Date(appointment.end).getTime(),
  }));

  const proposals: CalendarSlotProposal[] = [];

  roster.forEach((officer) => {
    collectBusinessAnchors(horizonDays).forEach((anchor) => {
      const dow = anchor.getUTCDay();
      officer.weeklyWindows
        .filter((window) => window.dow === dow)
        .forEach((window) => {
          let minuteCursor = window.startMin;
          while (minuteCursor + SLOT_DURATION_MIN <= window.endMin) {
            const start = utcDateFromMinutes(anchor, minuteCursor);
            const end = utcDateFromMinutes(anchor, minuteCursor + SLOT_DURATION_MIN);
            const startTs = start.getTime();

            if (startTs < Date.now() - 5_000) {
              minuteCursor += SLOT_DURATION_MIN;
              continue;
            }

            const blocked = occupancy.some(
              (block) =>
                block.officer === officer.id &&
                startTs >= block.start - 1_500 &&
                startTs < block.end,
            );

            if (!blocked) {
              proposals.push({
                loId: officer.id,
                start: start.toISOString(),
                end: end.toISOString(),
              });
            }

            minuteCursor += SLOT_DURATION_MIN;
          }
        });
    });
  });

  proposals.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  /** Keep UI payloads lean */
  return proposals.slice(0, 96);
}

export function bookAppointment(input: {
  borrowerLeadId: string;
  loId: string;
  startIso: string;
  notes?: string;
}): AppointmentRecord {
  const start = new Date(input.startIso);
  const durationMs = SLOT_DURATION_MIN * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const record: AppointmentRecord = {
    id: generateId("appt"),
    borrowerLeadId: input.borrowerLeadId,
    loId: input.loId,
    start: start.toISOString(),
    end: end.toISOString(),
    createdAt: new Date().toISOString(),
    borrowerNotes: input.notes,
  };

  appendAppointment(record);
  return record;
}
