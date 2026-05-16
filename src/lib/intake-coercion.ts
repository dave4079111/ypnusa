import type { FlowStepDescriptor } from "./flows";
import type { BorrowerAnswers } from "./types";

export type AnswerResult =
  | { ok: true; answers: BorrowerAnswers }
  | { ok: false; error: string };

function sanitizeNumber(raw: string, label: string) {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return { ok: false as const, error: `${label} cannot be blank` };
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false as const, error: `${label} must be numeric` };
  }
  if (value < 0) {
    return { ok: false as const, error: `${label} cannot be negative` };
  }
  return { ok: true as const, value };
}

function mergeBoolean(answer: BorrowerAnswers, raw: string, fieldPath: keyof BorrowerAnswers) {
  if (raw !== "true" && raw !== "false") {
    return { ok: false as const, error: "Select one of the provided quick replies" };
  }
  const next = { ...answer, [fieldPath]: raw === "true" };
  return { ok: true as const, answers: next as BorrowerAnswers };
}

export function mergeStructuredAnswer(
  answers: BorrowerAnswers,
  step: FlowStepDescriptor,
  rawInput: string,
): AnswerResult {
  const trimmed = rawInput.trim();
  const label = step.placeholder ?? step.id;

  if (step.kind === "boolean") {
    if (!trimmed) {
      return {
        ok: false,
        error: "Tap one of the quick replies so we capture the LOS nuance verbatim.",
      };
    }

    return mergeBoolean(answers, trimmed, step.fieldPath);
  }

  if (trimmed === "" && step.kind !== "boolean") {
    return { ok: false, error: `${label ?? "Answer"} looks empty` };
  }

  if (step.kind === "number") {
    const result = sanitizeNumber(trimmed, label);
    if (!result.ok) return result;
    return {
      ok: true,
      answers: { ...answers, [step.fieldPath]: Math.round(result.value) } as BorrowerAnswers,
    };
  }

  if (step.kind === "email") {
    /**
     * Extremely lightweight heuristic—wire to your validation library later
     */
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      return { ok: false, error: "Provide a workable email—we will encrypt before LOS sync." };
    }
    return { ok: true, answers: { ...answers, [step.fieldPath]: trimmed } as BorrowerAnswers };
  }

  /** text + tel share path */
  return { ok: true, answers: { ...answers, [step.fieldPath]: trimmed } as BorrowerAnswers };
}
