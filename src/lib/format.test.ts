import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCompactUsdFromCents,
  formatDateTime,
  formatUsd,
  formatUsdFromCents,
} from "./format";

describe("shared formatters", () => {
  it("formats whole dollars and falls back to zero for non-finite input", () => {
    assert.equal(formatUsd(1234.6), "$1,235");
    assert.equal(formatUsd(Number.NaN), "$0");
  });

  it("formats cent-denominated values", () => {
    assert.equal(formatUsdFromCents(123_456), "$1,234.56");
    assert.equal(formatCompactUsdFromCents(1_234_500), "$12.3K");
  });

  it("formats dates with overridable options", () => {
    const iso = "2026-03-04T15:30:00.000Z";

    assert.equal(formatDateTime(iso, { timeZone: "UTC" }), "Mar 4, 3:30 PM");
    assert.equal(
      formatDateTime(iso, { weekday: "short", timeZone: "UTC" }),
      "Wed, Mar 4, 3:30 PM",
    );
  });
});
