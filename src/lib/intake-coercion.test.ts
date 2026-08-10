import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlowStepDescriptor } from "./flows";
import { mergeStructuredAnswer } from "./intake-coercion";

describe("intake answer validation", () => {
  it("preserves mortgage-rate precision", () => {
    const step: FlowStepDescriptor = {
      id: "current_rate",
      prompt: "Current rate",
      fieldPath: "currentRatePct",
      kind: "number",
    };
    const result = mergeStructuredAnswer(
      { loanProgram: "REFI" },
      step,
      "7.125",
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.answers.currentRatePct, 7.125);
  });

  it("rejects values outside configured select options", () => {
    const step: FlowStepDescriptor = {
      id: "timeline",
      prompt: "Timeline",
      fieldPath: "timeline",
      kind: "select",
      chips: [{ label: "Soon", value: "lt_30" }],
    };
    const result = mergeStructuredAnswer(
      { loanProgram: "CONVENTIONAL" },
      step,
      "invented",
    );
    assert.deepEqual(result, {
      ok: false,
      error: "Select one of the provided options.",
    });
  });

  it("records immutable consent evidence", () => {
    const step: FlowStepDescriptor = {
      id: "consent",
      prompt: "Consent",
      fieldPath: "contactConsent",
      kind: "boolean",
    };
    const result = mergeStructuredAnswer(
      { loanProgram: "FHA" },
      step,
      "true",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.answers.emailConsent, true);
    assert.equal(result.answers.smsConsent, true);
    assert.equal(result.answers.contactConsentSource, "borrower_intake");
    assert.ok(result.answers.contactConsentAt);
  });
});
