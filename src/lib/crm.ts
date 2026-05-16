import { appendBorrowerLead, appendCrmLead, readDb } from "./db";
import { generateId } from "./id";
import type {
  BorrowerAnswers,
  BorrowerLeadRecord,
  CrmLeadRecord,
  LoanProgram,
  QualificationSummary,
} from "./types";

function countAssignments(officerId: string): number {
  const db = readDb();
  let total = db.borrowerLeads.filter((lead) => lead.assignedLoId === officerId).length;
  total += db.crmLeads.filter((crm) => crm.assignedLoId === officerId).length;
  return total;
}

export function routeLoanOfficer(program: LoanProgram) {
  const db = readDb();
  const candidates = db.loanOfficers.filter((officer) => officer.specialties.includes(program));

  const pool = candidates.length > 0 ? candidates : db.loanOfficers;

  let choice = pool[0];
  let smallest = Number.POSITIVE_INFINITY;

  pool.forEach((candidate) => {
    const tally = countAssignments(candidate.id);
    if (tally < smallest) {
      smallest = tally;
      choice = candidate;
    }
  });

  return choice;
}

export interface CrmSyncResult {
  borrowerLeadId: string;
  crmLeadId: string;
  assignedLoId: string;
  notes: string[];
}

export function logCrmActivity(
  answers: BorrowerAnswers,
  qualification: QualificationSummary,
  assignedLoId: string,
  funnelSource?: string,
  sessionId?: string,
): CrmSyncResult {
  const borrowerId = generateId("lead");

  /** CRM mirrored notes emulate Salesforce / HubSpot custom fields */
  const notes = [
    `Funnel cohort: ${funnelSource ?? "unspecified_ai_channel"}`,
    `LOS composite ${Math.round(qualification.programScores.overallScore ?? 0)} / quality ${qualification.leadQuality}`,
    `AI coaching: ${qualification.recommendedNextStep}`,
    `Session lineage: ${sessionId ?? borrowerId}`,
  ];

  qualification.rationale.slice(0, 4).forEach((bullet) => notes.push(`Model note ▸ ${bullet}`));

  const lead: BorrowerLeadRecord = {
    id: borrowerId,
    createdAt: new Date().toISOString(),
    funnelSource,
    assignedLoId,
    qualification,
    crmLeadId: "",
    answers,
    sessionId,
  };

  const crm: CrmLeadRecord = {
    id: generateId("crm"),
    createdAt: new Date().toISOString(),
    borrowerLeadId: borrowerId,
    funnelSource,
    assignedLoId,
    status: "new_ai_routed",
    notes,
    qualificationSnapshot: qualification,
  };

  lead.crmLeadId = crm.id;

  appendBorrowerLead(lead);
  appendCrmLead(crm);

  return { borrowerLeadId: borrowerId, crmLeadId: crm.id, assignedLoId, notes };
}
