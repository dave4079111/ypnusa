import { appendLoAlert } from "./db";
import { generateId } from "./id";
import type { BorrowerAnswers, LoanProgram, LoAlertRecord, QualificationSummary } from "./types";

export function notifyAssignedOfficer(payload: {
  loId: string;
  borrowerLeadId: string;
  loanProgram: LoanProgram;
  answers: BorrowerAnswers;
  qualification: QualificationSummary;
}): LoAlertRecord {
  const record: LoAlertRecord = {
    id: generateId("alert"),
    createdAt: new Date().toISOString(),
    loId: payload.loId,
    borrowerLeadId: payload.borrowerLeadId,
    loanProgram: payload.loanProgram,
    summary: summarizeBorrower(payload.answers),
    qualificationSummary: payload.qualification,
    suggestedAction: payload.qualification.recommendedNextStep,
  };

  appendLoAlert(record);
  return record;
}

function summarizeBorrower(answers: BorrowerAnswers): string {
  return [
    answers.name ?? "Borrower name pending",
    answers.email ?? "email pending",
    answers.phone ?? "phone pending",
    `Program ${answers.loanProgram}`,
    `Intent ${answers.purchaseRefiIntent ?? "unset"}`,
  ].join(" · ");
}
