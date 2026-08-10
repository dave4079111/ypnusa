import { appendAnalytics, persistSession, readDb } from "./db";
import { processDueFollowUps, scheduleBorrowerJourney } from "./automation";
import { createBookingToken } from "./booking-auth";
import { logCrmActivity, routeLoanOfficer } from "./crm";
import { buildQualification, recommendPrograms } from "./qualification";
import type { BorrowerAnswers, IntakeSessionRecord, LoanProgram } from "./types";
import { notifyAssignedOfficer } from "./notifications";
import { mirrorIntakeToExternalWebhook } from "./external-webhook";

export interface BorrowerFinalizeSnapshot {
  alreadyCompleted: boolean;
  borrowerLeadId?: string;
  crmLeadId?: string;
  qualification?: ReturnType<typeof buildQualification>;
  assignedOfficer?: { id: string; name: string; email: string };
  routedPrograms?: LoanProgram[];
  followUpsQueued?: number;
  immediateOutreachSent?: number;
  immediateOutreachFailed?: number;
  bookingToken?: string;
  externalMirrorDelivered?: boolean;
}

export async function finalizeIntakeArtifacts(
  session: IntakeSessionRecord,
  options?: { assignedLoId?: string },
): Promise<BorrowerFinalizeSnapshot | { ok: false; message: string }> {
  const answers: BorrowerAnswers = {
    ...session.answers,
    loanProgram: session.loanProgram,
    funnelSource: session.funnelSource,
  };

  if (
    !(answers.email && answers.phone && answers.name && answers.timeline && answers.estimatedCreditBand)
  ) {
    return {
      ok: false,
      message: "Incomplete borrower profile prevents CRM hydration.",
    };
  }

  if (session.status === "crm_synced" && session.borrowerLeadId) {
    const db = readDb();
    const lead = db.borrowerLeads.find((item) => item.id === session.borrowerLeadId);
    if (!lead) {
      return {
        ok: false,
        message: "Historical session missing LOS artifacts—restart intake.",
      };
    }

    const officer = db.loanOfficers.find((item) => item.id === lead.assignedLoId);

    return {
      alreadyCompleted: true,
      borrowerLeadId: session.borrowerLeadId,
      crmLeadId: session.crmLeadId ?? lead.crmLeadId,
      qualification: lead.qualification,
      assignedOfficer: officer
        ? { id: officer.id, name: officer.name, email: officer.email }
        : undefined,
      routedPrograms: recommendPrograms(lead.answers),
      followUpsQueued: db.followUps.filter((job) => job.borrowerLeadId === lead.id).length,
      bookingToken: officer
        ? createBookingToken(lead.id, officer.id)
        : undefined,
    };
  }

  const qualification = buildQualification(answers);
  const officerProfile = options?.assignedLoId
    ? readDb().loanOfficers.find((officer) => officer.id === options.assignedLoId)
    : routeLoanOfficer(session.loanProgram, answers.propertyZip);
  if (!officerProfile) {
    return {
      ok: false,
      message: "The assigned MLO profile is unavailable.",
    };
  }

  const crm = logCrmActivity(
    answers,
    qualification,
    officerProfile.id,
    session.funnelSource,
    session.id,
  );

  notifyAssignedOfficer({
    loId: officerProfile.id,
    borrowerLeadId: crm.borrowerLeadId,
    loanProgram: session.loanProgram,
    answers,
    qualification,
  });

  const followUpsQueued = scheduleBorrowerJourney(crm.borrowerLeadId, answers).length;
  const immediateOutreach = await processDueFollowUps({
    borrowerLeadId: crm.borrowerLeadId,
    limit: 2,
  });

  const patched: IntakeSessionRecord = {
    ...session,
    status: "crm_synced",
    borrowerLeadId: crm.borrowerLeadId,
    crmLeadId: crm.crmLeadId,
  };

  persistSession(patched);

  appendAnalytics({
    type: "intake_completed",
    payload: {
      program: session.loanProgram,
      leadQuality: qualification.leadQuality,
      borrowerLeadId: crm.borrowerLeadId,
    },
  });

  const externalMirrorDelivered = await mirrorIntakeToExternalWebhook({
    event: "intake.completed",
    receivedAt: new Date().toISOString(),
    borrowerLeadId: crm.borrowerLeadId,
    crmLeadId: crm.crmLeadId,
    sessionId: session.id,
    loanProgram: session.loanProgram,
    funnelSource: session.funnelSource,
    answers,
    qualification,
    assignedOfficer: {
      id: officerProfile.id,
      name: officerProfile.name,
      email: officerProfile.email,
    },
    ingestStack: "loanapilot_next",
  });

  return {
    alreadyCompleted: false,
    borrowerLeadId: crm.borrowerLeadId,
    crmLeadId: crm.crmLeadId,
    qualification,
    assignedOfficer: {
      id: officerProfile.id,
      name: officerProfile.name,
      email: officerProfile.email,
    },
    routedPrograms: recommendPrograms(answers),
    followUpsQueued,
    immediateOutreachSent: immediateOutreach.processed,
    immediateOutreachFailed: immediateOutreach.failed,
    bookingToken: createBookingToken(crm.borrowerLeadId, officerProfile.id),
    externalMirrorDelivered,
  };
}
