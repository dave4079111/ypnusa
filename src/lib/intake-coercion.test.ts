import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlowStepDescriptor } from "./flows";
import { mergeStructuredAnswer } from "./intake-coercion";
import type { BorrowerAnswers } from "./types";

const base: BorrowerAnswers = { loanProgram: "CONVENTIONAL" };

function step(overrides: Partial<FlowStepDescriptor>): FlowStepDescriptor {
  return {
    id: "test_step",
    prompt: "Prompt",
    fieldPath: "name",
    kind: "text",
    ...overrides,
  };
}

describe("mergeStructuredAnswer — boolean steps", () => {
  const consent = step({
    id: "contact_consent",
    fieldPath: "contactConsent",
    kind: "boolean",
  });

  it("stores both explicit consent decisions", () => {
    const granted = mergeStructuredAnswer(base, consent, "true");
    const declined = mergeStructuredAnswer(base, consent, " false ");

    assert.ok(granted.ok && granted.answers.contactConsent === true);
    assert.ok(declined.ok && declined.answers.contactConsent === false);
  });

  it("rejects blank and free-text replies instead of guessing consent", () => {
    const blank = mergeStructuredAnswer(base, consent, "   ");
    const freeText = mergeStructuredAnswer(base, consent, "maybe");

    assert.equal(blank.ok, false);
    assert.equal(freeText.ok, false);
    assert.ok(!freeText.ok && /quick replies/i.test(freeText.error));
  });
});

describe("mergeStructuredAnswer — number steps", () => {
  const amount = step({
    id: "target_amount",
    fieldPath: "targetLoanAmountUsd",
    kind: "number",
    placeholder: "Target amount",
  });

  it("accepts currency formatting and common shorthand", () => {
    const formatted = mergeStructuredAnswer(base, amount, " $500,000 ");
    const thousands = mergeStructuredAnswer(base, amount, "500k");
    const millions = mergeStructuredAnswer(base, amount, "1.25m");

    assert.ok(formatted.ok && formatted.answers.targetLoanAmountUsd === 500_000);
    assert.ok(thousands.ok && thousands.answers.targetLoanAmountUsd === 500_000);
    assert.ok(millions.ok && millions.answers.targetLoanAmountUsd === 1_250_000);
  });

  it("rounds fractional values and rejects invalid or negative amounts", () => {
    const fractional = mergeStructuredAnswer(base, amount, "120500.62");
    const words = mergeStructuredAnswer(base, amount, "about a hundred k");
    const negative = mergeStructuredAnswer(base, amount, "-5000");

    assert.ok(fractional.ok && fractional.answers.targetLoanAmountUsd === 120_501);
    assert.ok(!words.ok && words.error === "Target amount must be numeric");
    assert.ok(!negative.ok && negative.error === "Target amount cannot be negative");
  });

  it("falls back to the step id when no placeholder exists", () => {
    const result = mergeStructuredAnswer(
      base,
      step({ id: "annual_income", fieldPath: "annualIncomeUsd", kind: "number" }),
      "nope",
    );

    assert.ok(!result.ok && result.error === "annual_income must be numeric");
  });
});

describe("mergeStructuredAnswer — email, text, and empty input", () => {
  const email = step({ id: "borrower_email", fieldPath: "email", kind: "email" });

  it("keeps a workable address and rejects malformed ones", () => {
    const ok = mergeStructuredAnswer(base, email, "  taylor@example.com ");

    assert.ok(ok.ok && ok.answers.email === "taylor@example.com");
    for (const invalid of ["taylor", "taylor@example", "taylor example.com", "a@b@c.com"]) {
      assert.equal(mergeStructuredAnswer(base, email, invalid).ok, false, invalid);
    }
  });

  it("trims text and tel answers without further validation", () => {
    const name = mergeStructuredAnswer(base, step({ fieldPath: "name", kind: "text" }), "  Taylor  ");
    const phone = mergeStructuredAnswer(
      base,
      step({ fieldPath: "phone", kind: "tel" }),
      " (555) 123-9876 ",
    );

    assert.ok(name.ok && name.answers.name === "Taylor");
    assert.ok(phone.ok && phone.answers.phone === "(555) 123-9876");
  });

  it("rejects whitespace-only input for every non-boolean step", () => {
    const result = mergeStructuredAnswer(base, email, "   ");

    assert.ok(!result.ok && /empty/i.test(result.error));
  });

  it("never mutates the answers it was given", () => {
    const answers: BorrowerAnswers = { loanProgram: "FHA" };
    const result = mergeStructuredAnswer(answers, step({ fieldPath: "name" }), "Taylor");

    assert.ok(result.ok && result.answers !== answers);
    assert.deepEqual(answers, { loanProgram: "FHA" });
  });
});
