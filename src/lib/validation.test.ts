import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidEmail, optionalText, requiredText, roundedAmount } from "./validation";

describe("request field coercion", () => {
  it("trims, caps, and drops blank strings", () => {
    assert.equal(optionalText("  YPN USA  ", 160), "YPN USA");
    assert.equal(optionalText("abcdef", 3), "abc");
    assert.equal(optionalText("   ", 10), undefined);
    assert.equal(optionalText(42, 10), undefined);
  });

  it("reports missing required fields as null", () => {
    assert.equal(requiredText("lead_123", 160), "lead_123");
    assert.equal(requiredText("", 160), null);
    assert.equal(requiredText(undefined, 160), null);
  });

  it("rounds finite numeric amounts only", () => {
    assert.equal(roundedAmount(500_000.4), 500_000);
    assert.equal(roundedAmount(Number.NaN), undefined);
    assert.equal(roundedAmount("500000"), undefined);
  });

  it("validates email shape", () => {
    assert.equal(isValidEmail("broker@ypnus.com"), true);
    assert.equal(isValidEmail("broker@ypnus"), false);
    assert.equal(isValidEmail("broker ypnus.com"), false);
  });
});
