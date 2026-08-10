import { calendarConnectionStatus } from "./calendar";
import { readDb } from "./db";
import type { FollowUpChannel, LoanProgram, Urgency } from "./types";

export interface NurtureDashboardRow {
  leadId: string;
  borrowerName: string;
  loanProgram: LoanProgram;
  timeline: string;
  creditTier: string;
  score: number;
  quality: string;
  urgency: Urgency;
  officerName: string;
  state: "Awaiting booking" | "Appointment booked" | "Nurture active" | "Outreach failed";
  nextFollowUp?: string;
  nextChannel?: FollowUpChannel;
  appointmentStart?: string;
  meetingUrl?: string;
}

const urgencyRank: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  standard: 2,
  low: 3,
};

function safeDisplayName(name?: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "Borrower";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function buildNurtureDashboard(loId?: string) {
  const db = readDb();
  const officers = loId
    ? db.loanOfficers.filter((officer) => officer.id === loId)
    : db.loanOfficers;
  const officerIds = new Set(officers.map((officer) => officer.id));
  const leads = db.borrowerLeads.filter((lead) => officerIds.has(lead.assignedLoId));
  const now = Date.now();

  const rows: NurtureDashboardRow[] = leads
    .map((lead) => {
      const officer = officers.find((item) => item.id === lead.assignedLoId);
      const followUps = db.followUps
        .filter((item) => item.borrowerLeadId === lead.id)
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
      const nextFollowUp = followUps.find((item) => item.status === "pending");
      const failed = followUps.some((item) => item.status === "failed");
      const appointment = db.appointments
        .filter((item) => item.borrowerLeadId === lead.id)
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];

      let state: NurtureDashboardRow["state"] = "Awaiting booking";
      if (appointment) state = "Appointment booked";
      else if (failed && !nextFollowUp) state = "Outreach failed";
      else if (nextFollowUp) state = "Nurture active";

      return {
        leadId: lead.id,
        borrowerName: safeDisplayName(lead.answers.name),
        loanProgram: lead.answers.loanProgram,
        timeline: lead.answers.timeline ?? "Not provided",
        creditTier: lead.answers.estimatedCreditBand ?? "Not provided",
        score: Math.round(lead.qualification.programScores.overallScore ?? 0),
        quality: lead.qualification.leadQuality,
        urgency: lead.qualification.urgency,
        officerName: officer?.name ?? "Unassigned",
        state,
        nextFollowUp: nextFollowUp?.scheduledAt,
        nextChannel: nextFollowUp?.channel,
        appointmentStart: appointment?.start,
        meetingUrl: appointment?.meetingUrl ?? appointment?.externalBookingUrl,
      };
    })
    .sort((a, b) => {
      const urgencyDifference = urgencyRank[a.urgency] - urgencyRank[b.urgency];
      if (urgencyDifference !== 0) return urgencyDifference;
      if (a.score !== b.score) return b.score - a.score;

      const aTime = a.appointmentStart ?? a.nextFollowUp;
      const bTime = b.appointmentStart ?? b.nextFollowUp;
      if (!aTime && !bTime) return a.leadId.localeCompare(b.leadId);
      if (!aTime) return 1;
      if (!bTime) return -1;
      return Date.parse(aTime) - Date.parse(bTime);
    });

  const upcomingAppointments = rows.filter(
    (row) => row.appointmentStart && Date.parse(row.appointmentStart) >= now,
  ).length;
  const activeConversations = rows.filter((row) => row.state !== "Appointment booked").length;
  const pendingTouches = db.followUps.filter(
    (item) => officerIds.has(
      db.borrowerLeads.find((lead) => lead.id === item.borrowerLeadId)?.assignedLoId ?? "",
    ) && item.status === "pending",
  ).length;
  const averageScore =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length);

  return {
    totals: {
      activeConversations,
      upcomingAppointments,
      pendingTouches,
      averageScore,
    },
    calendarConnections: officers.map((officer) => ({
      officerId: officer.id,
      officerName: officer.name,
      ...calendarConnectionStatus(officer),
    })),
    rows,
  };
}
