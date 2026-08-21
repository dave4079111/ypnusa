import { appendAnalytics, persistSession, readDb } from "./db";
import { processDueFollowUps, scheduleBorrowerJourney } from "./automation";
import { logCrmActivity, routeLoanOfficer } from "./crm";
import { buildQualification, recommendPrograms } from "./qualification";
import type { BorrowerAnswers, IntakeSessionRecord, LoanProgram } from "./types";
import { notifyAssignedOfficer } from "./notifications";
import { mirrorIntakeToExternalWebhook } from "./external-webhook";
import { buildZipContext } from "./agents/zipContext";
import { buildCountyEvents } from "./agents/countyEvents";
import { scoreLead, type Lead } from "./agents/predictiveAgent";
import { buildBorrowerProfile, type BorrowerProfileBasics } from "./borrower/profileEngine";
import { buildOutcomeSignals } from "./predictive/outcomeEngine";
import { buildLeadState } from "./lead-lifecycle";
import { decideNextAction } from "./next-best-action";

function creditConfidenceFromBand(band?: string): BorrowerProfileBasics["creditConfidence"] {
  switch (band) {
    case "740-850":
      return "excellent";
    case "670-739":
      return "good";
    case "620-669":
      return "fair";
    case "580-619":
      return "building";
    default:
      return "unsure";
  }
}

function goalFromAnswers(answers: BorrowerAnswers): string {
  if (answers.purchaseRefiIntent === "refinance") {
    return answers.refinanceGoal ? `refinance (${answers.refinanceGoal})` : "refinance";
  }
  if (answers.purchaseRefiIntent === "purchase") return "purchase";
  if (answers.loanProgram === "DSCR") return "investment property purchase";
  return "explore financing options";
}

/**
 * Best-effort ZIP/predictive intelligence for a just-completed lead — additive
 * to the CRM sync above. Never throws: zipContext.ts/countyEvents.ts return
 * neutral placeholders without live provider env vars, and BorrowerAnswers.zip
 * isn't currently collected by the intake flow, so this quietly no-ops
 * whenever a ZIP isn't available rather than blocking intake completion.
 */
async function connectLeadIntelligence(input: {
  answers: BorrowerAnswers;
  session: IntakeSessionRecord;
  borrowerLeadId: string;
  loId: string;
  followUps: ReturnType<typeof scheduleBorrowerJourney>;
}): Promise<void> {
  const { answers, session, borrowerLeadId, loId, followUps } = input;
  if (!answers.zip) return;

  try {
    const zipContext = await buildZipContext(answers.zip);
    const countyEvents = await buildCountyEvents(zipContext.county);
    const lead: Lead = {
      id: borrowerLeadId,
      name: answers.name ?? "Borrower",
      email: answers.email,
      phone: answers.phone,
      zip: answers.zip,
      tags: [session.loanProgram],
      createdAt: session.createdAt,
    };
    const predictive = scoreLead(lead, zipContext, countyEvents);

    const borrowerProfile = buildBorrowerProfile({
      borrower: {
        zip: answers.zip,
        goal: goalFromAnswers(answers),
        timeline: answers.timeline ?? "",
        propertyType: answers.propertyType,
        creditConfidence: creditConfidenceFromBand(answers.estimatedCreditBand),
      },
      zipContext,
      countyEvents,
      predictive,
    });

    const outcomeSignals = buildOutcomeSignals({
      zipContext,
      countyEvents,
      predictive,
      borrowerProfile,
      funnelStage: "completed_signup",
    });

    const leadState = buildLeadState({
      session,
      followUps,
      answers,
      recentFollowUps: followUps,
      currentObjective: "connect borrower with loan officer",
    });

    const action = decideNextAction({
      state: leadState,
      predictiveSignal: {
        leadScore: predictive.leadScore,
        lifeEventLikelihood: predictive.lifeEventLikelihood,
        outcomeSignals,
      },
    });

    appendAnalytics({
      type: "lead_intelligence_computed",
      payload: {
        borrowerLeadId,
        leadScore: predictive.leadScore,
        lifeEventLikelihood: predictive.lifeEventLikelihood,
        followUpNecessity: outcomeSignals.followUpNecessity,
        persona: borrowerProfile.persona,
        nextAction: action.kind,
      },
    });

    if (action.kind === "alert_mlo") {
      const db = readDb();
      const borrowerLeadRecord = db.borrowerLeads.find((item) => item.id === borrowerLeadId);
      if (borrowerLeadRecord) {
        notifyAssignedOfficer({
          loId,
          borrowerLeadId,
          loanProgram: session.loanProgram,
          answers,
          qualification: borrowerLeadRecord.qualification,
        });
      }
    }
  } catch (error) {
    console.error("[intake-pipeline] lead intelligence connection failed", error);
  }
}

export interface BorrowerFinalizeSnapshot {
  alreadyCompleted: boolean;
  borrowerLeadId?: string;
  crmLeadId?: string;
  qualification?: ReturnType<typeof buildQualification>;
  assignedOfficer?: { id: string; name: string; email: string };
  routedPrograms?: LoanProgram[];
  followUpsQueued?: number;
  immediateOutreachSent?: number;
}

export async function finalizeIntakeArtifacts(
  session: IntakeSessionRecord,
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
    };
  }

  const qualification = buildQualification(answers);
  const officerProfile = routeLoanOfficer(session.loanProgram);

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

  const followUps = scheduleBorrowerJourney(crm.borrowerLeadId, answers);
  const followUpsQueued = followUps.length;
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

  await connectLeadIntelligence({
    answers,
    session: patched,
    borrowerLeadId: crm.borrowerLeadId,
    loId: officerProfile.id,
    followUps,
  });

  void mirrorIntakeToExternalWebhook({
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
  };
}
