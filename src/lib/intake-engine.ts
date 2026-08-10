import { appendAnalytics, persistSession, readDb } from "./db";
import { generateId } from "./id";
import { finalizeIntakeArtifacts, type BorrowerFinalizeSnapshot } from "./intake-pipeline";
import { mergeStructuredAnswer } from "./intake-coercion";
import { findNextStep, greetingForProgram, summarizeFlowProgress, type FlowStepDescriptor } from "./flows";
import { listAvailableSlots } from "./calendar";
import type { AssistantStep, IntakeTickRequest, IntakeTickResponse } from "./intake-contracts";
import type { BorrowerAnswers, IntakeSessionRecord, LoanProgram } from "./types";
import { coerceLoanProgram } from "./programs";

const FALLBACK_PROGRAM: LoanProgram = "FHA";

function resolveFunnel(candidate?: string): string {
  const trimmed = candidate?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "loanpilot_ai_surface";
}

function toSerializable(step: FlowStepDescriptor): AssistantStep {
  return {
    id: step.id,
    field: step.fieldPath,
    prompt: step.prompt,
    placeholder: step.placeholder,
    hint: step.hint,
    chips: step.chips,
    kind: step.kind,
  };
}

export function hydrateAnswers(session: IntakeSessionRecord): BorrowerAnswers {
  const answers = session.answers ?? {};
  return {
    ...answers,
    loanProgram: session.loanProgram,
    funnelSource: session.funnelSource,
  };
}

function formatRecap(snapshot: BorrowerFinalizeSnapshot): string {
  const lanes = snapshot.routedPrograms?.join(", ") ?? "";

  const introBlock = snapshot.qualification
    ? [
        `Lead aura: ${snapshot.qualification.leadQuality.toUpperCase()} · urgency ${snapshot.qualification.urgency.toUpperCase()} · LOS composite ${Math.round(snapshot.qualification.programScores.overallScore ?? 0)}.`,
        `Program matrix: ${lanes}.`,
        `AI LOS coaching: ${snapshot.qualification.recommendedNextStep}`,
      ]
    : [];

  const owner =
    snapshot.assignedOfficer &&
    `${snapshot.alreadyCompleted ? "Continuing with" : "Live assignment:"} ${snapshot.assignedOfficer.name} (${snapshot.assignedOfficer.email}).`;

  const nurture =
    snapshot.followUpsQueued && snapshot.followUpsQueued > 0
      ? `${snapshot.followUpsQueued} nurture automations queued (email + SMS + drip).`
      : "";

  return [...introBlock, owner, nurture].filter(Boolean).join("\n");
}

function slotPreview(officerId: string): Array<{ start: string; end: string; loId: string }> {
  return listAvailableSlots(officerId, 9).slice(0, 10);
}

type FinalOutcome = BorrowerFinalizeSnapshot | { ok: false; message: string };

function isSyncedSnapshot(snapshot: FinalOutcome): snapshot is BorrowerFinalizeSnapshot {
  return "borrowerLeadId" in snapshot;
}

export async function intakeTick(payload: IntakeTickRequest): Promise<IntakeTickResponse> {
  const emptyProgress = { pct: 0, completed: 0, totalApplicable: 0 };

  const program = coerceLoanProgram(payload.loanProgram);
  const baseFail = (
    message: string,
    extras?: Partial<Omit<IntakeTickResponse, "ok" | "error">>,
  ): IntakeTickResponse => ({
    ok: false,
    error: message,
    sessionId: extras?.sessionId ?? "",
    phase: extras?.phase ?? "collecting",
    progress: extras?.progress ?? emptyProgress,
    assistantMessage: extras?.assistantMessage ?? message,
    answers: extras?.answers ?? { loanProgram: extras?.loanProgram ?? FALLBACK_PROGRAM },
    loanProgram: extras?.loanProgram ?? FALLBACK_PROGRAM,
    activeStep: extras?.activeStep,
  });

  if (!program) {
    return baseFail("Select a funded program lane.", {
      loanProgram: FALLBACK_PROGRAM,
      answers: { loanProgram: FALLBACK_PROGRAM },
    });
  }

  let session: IntakeSessionRecord | undefined;
  let isFreshSession = false;

  if (payload.sessionId) {
    session = readDb().sessions.find((item) => item.id === payload.sessionId);
    if (!session) {
      return baseFail("Session stale—restart the concierge.", {
        loanProgram: program,
        answers: { loanProgram: program },
      });
    }
    if (
      session.expiresAt &&
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      return baseFail("Session expired—restart the concierge.", {
        loanProgram: program,
        answers: { loanProgram: program },
      });
    }

    if (session.loanProgram !== program) {
      return baseFail("Program lanes lock per borrower session.", {
        sessionId: session.id,
        loanProgram: session.loanProgram,
        answers: hydrateAnswers(session),
        phase: session.status === "crm_synced" ? "crm_synced" : "collecting",
        progress: summarizeFlowProgress(session.loanProgram, hydrateAnswers(session)),
      });
    }
  } else {
    isFreshSession = true;
    session = {
      id: generateId("sess"),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      funnelSource: resolveFunnel(payload.funnelSource),
      loanProgram: program,
      status: "collecting",
      answers: { loanProgram: program },
    };
    persistSession(session);

    appendAnalytics({
      type: "intake_started",
      payload: { program, funnel: session.funnelSource },
    });
  }

  if (session.status === "crm_synced") {
    if (payload.incoming) {
      return baseFail("Lead already flowed to LOS—booking only from here.", {
        sessionId: session.id,
        phase: "crm_synced",
        loanProgram: session.loanProgram,
        answers: hydrateAnswers(session),
        progress: summarizeFlowProgress(session.loanProgram, hydrateAnswers(session)),
        assistantMessage: "Synced profile is locked—use the booking rail.",
      });
    }

    const snapshot = await finalizeIntakeArtifacts(session);
    if (!isSyncedSnapshot(snapshot)) {
      return baseFail(snapshot.message, {
        sessionId: session.id,
        phase: "crm_synced",
        loanProgram: session.loanProgram,
        answers: hydrateAnswers(session),
        progress: summarizeFlowProgress(session.loanProgram, hydrateAnswers(session)),
      });
    }

    return {
      ok: true,
      sessionId: session.id,
      phase: "crm_synced",
      progress: summarizeFlowProgress(session.loanProgram, hydrateAnswers(session)),
      assistantMessage: formatRecap(snapshot),
      answers: hydrateAnswers(session),
      loanProgram: session.loanProgram,
      activeStep: null,
      qualification: snapshot.qualification,
      crmArtifacts: snapshot,
      slotPreview: snapshot.assignedOfficer ? slotPreview(snapshot.assignedOfficer.id) : [],
    };
  }

  let workingAnswers = hydrateAnswers(session);

  if (payload.incoming) {
    const awaiting = findNextStep(session.loanProgram, workingAnswers);
    if (!awaiting || awaiting.fieldPath !== payload.incoming.field) {
      const active = awaiting;
      return baseFail("Answer sequencing drifted—reload the concierge.", {
        sessionId: session.id,
        loanProgram: session.loanProgram,
        answers: workingAnswers,
        progress: summarizeFlowProgress(session.loanProgram, workingAnswers),
        assistantMessage: "Please react to the latest assistant prompt.",
        activeStep: active ? toSerializable(active) : null,
      });
    }

    const merged = mergeStructuredAnswer(workingAnswers, awaiting, payload.incoming.rawValue);
    if (!merged.ok) {
      return baseFail(merged.error, {
        sessionId: session.id,
        loanProgram: session.loanProgram,
        answers: workingAnswers,
        progress: summarizeFlowProgress(session.loanProgram, workingAnswers),
        assistantMessage: merged.error,
        activeStep: toSerializable(awaiting),
      });
    }

    session.answers = {
      ...merged.answers,
      loanProgram: session.loanProgram,
    };
    persistSession(session);

    appendAnalytics({
      type: "intake_progress",
      payload: {
        sessionId: session.id,
        program: session.loanProgram,
        field: payload.incoming.field,
      },
    });
  }

  workingAnswers = hydrateAnswers(session);
  const nextPrompt = findNextStep(session.loanProgram, workingAnswers);

  if (!nextPrompt) {
    const finalized = await finalizeIntakeArtifacts(session);
    if (!isSyncedSnapshot(finalized)) {
      return baseFail(finalized.message, {
        sessionId: session.id,
        loanProgram: session.loanProgram,
        answers: workingAnswers,
        progress: summarizeFlowProgress(session.loanProgram, workingAnswers),
      });
    }

    const refreshedSession = readDb().sessions.find((entry) => entry.id === session.id);
    workingAnswers = refreshedSession ? hydrateAnswers(refreshedSession) : workingAnswers;

    return {
      ok: true,
      sessionId: session.id,
      phase: "crm_synced",
      progress: summarizeFlowProgress(session.loanProgram, workingAnswers),
      assistantMessage: formatRecap(finalized),
      answers: workingAnswers,
      loanProgram: session.loanProgram,
      activeStep: null,
      qualification: finalized.qualification,
      crmArtifacts: finalized,
      slotPreview: finalized.assignedOfficer ? slotPreview(finalized.assignedOfficer.id) : [],
    };
  }

  let assistantBubble = "";

  if (isFreshSession && !payload.incoming) {
    assistantBubble = `${greetingForProgram(session.loanProgram)}\n\n${nextPrompt.prompt}`;
  } else {
    assistantBubble = nextPrompt.prompt;
  }

  return {
    ok: true,
    sessionId: session.id,
    phase: "collecting",
    progress: summarizeFlowProgress(session.loanProgram, workingAnswers),
    assistantMessage: assistantBubble,
    answers: workingAnswers,
    loanProgram: session.loanProgram,
    activeStep: toSerializable(nextPrompt),
  };
}
