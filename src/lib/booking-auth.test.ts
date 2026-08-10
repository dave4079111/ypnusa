import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBookingToken, verifyBookingToken } from "./booking-auth";

process.env.BOOKING_TOKEN_SECRET =
  "booking-token-test-secret-that-is-more-than-thirty-two-bytes";

describe("borrower booking capabilities", () => {
  it("binds a short-lived token to one lead and MLO", () => {
    const now = Date.now();
    const token = createBookingToken("lead_1", "mlo_1", now);
    assert.ok(token);
    assert.equal(verifyBookingToken(token, "lead_1", "mlo_1", now), true);
    assert.equal(verifyBookingToken(token, "lead_2", "mlo_1", now), false);
    assert.equal(verifyBookingToken(token, "lead_1", "mlo_2", now), false);
    assert.equal(
      verifyBookingToken(token, "lead_1", "mlo_1", now + 31 * 60_000),
      false,
    );
  });

  it("rejects a tampered capability", () => {
    const token = createBookingToken("lead_1", "mlo_1");
    assert.ok(token);
    assert.equal(
      verifyBookingToken(`${token.slice(0, -1)}x`, "lead_1", "mlo_1"),
      false,
    );
  });
});
