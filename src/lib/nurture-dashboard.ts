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
  /** Populated only when the lead's ZIP is resolvable and the caller supplies a matching predictiveByZip entry. */
  lifeEventLikelihood?: number;
  zipDemandNote?: string;
  /** Set only when the agent pipeline (agent-executor.ts) escalated this lead beyond its
   *  initial routing alert — i.e. something changed and it flagged the MLO again. */
  aiEscalation?: { reason: string; createdAt: string };
  /** Most recent agent-authored CRM note (agent-executor.ts's add_crm_note), if any. */
  latestAgentNote?: string;
}

export interface PredictiveZipSignal {
  lifeEventLikelihood: number;
  zipDemandNote?: string;
}

export interface EquityReviewRow {
  evaluationId: string;
  borrowerName: string;
  zip: string;
  estimatedEquityUsd: number;
  illustrativeCashOutUsd: number;
  estimatedLtvPct: number;
  createdAt: string;
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

/**
 * predictiveByZip is an optional, caller-supplied lookup (e.g. pre-fetched via
 * src/lib/agents/zipContext.ts + predictiveAgent.ts for the ZIPs present among
 * the leads) so this function itself stays synchronous — buildNurtureDashboard
 * is called without `await` by two existing tests and the /portal/nurture
 * page, and ZIP-context resolution requires async I/O.
 */
export function buildNurtureDashboard(loId?: string, predictiveByZip?: Record<string, PredictiveZipSignal>) {
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

      const zip = lead.answers.zip;
      const predictive = zip ? predictiveByZip?.[zip] : undefined;

      const alerts = db.loAlerts
        .filter((item) => item.borrowerLeadId === lead.id)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      // The first alert is always the initial routing notification every lead gets;
      // a second one means the agent pipeline flagged this lead again after that.
      const escalation = alerts.length > 1 ? alerts[0] : undefined;

      const crmLead = db.crmLeads.find((item) => item.borrowerLeadId === lead.id);
      const latestAgentNote = crmLead?.notes.filter((note) => note.startsWith("Agent ▸")).at(-1);

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
        lifeEventLikelihood: predictive?.lifeEventLikelihood,
        zipDemandNote: predictive?.zipDemandNote,
        aiEscalation: escalation
          ? { reason: escalation.suggestedAction, createdAt: escalation.createdAt }
          : undefined,
        latestAgentNote,
      };
    })
    .sort((a, b) => {
      // A fresh agent escalation means something changed after intake — surface it
      // ahead of static urgency/score, which only reflect the original qualification.
      const escalationDifference = Number(Boolean(b.aiEscalation)) - Number(Boolean(a.aiEscalation));
      if (escalationDifference !== 0) return escalationDifference;

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
  const equityReviews: EquityReviewRow[] = db.propertyEvaluations
    .filter((evaluation) => evaluation.status === "new")
    .map((evaluation) => ({
      evaluationId: evaluation.id,
      borrowerName: safeDisplayName(evaluation.name),
      zip: evaluation.zip,
      estimatedEquityUsd: evaluation.estimatedEquityUsd,
      illustrativeCashOutUsd: evaluation.illustrativeCashOutUsd,
      estimatedLtvPct: evaluation.estimatedLtvPct,
      createdAt: evaluation.createdAt,
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

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
    equityReviews,
  };
}
