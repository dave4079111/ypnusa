import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { parseStripeEvent, verifyStripeSignature } from "./stripe";

const SECRET = "whsec_test_secret";

function stripeHeader(payload: string, timestamp: number, secret = SECRET): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly-signed, fresh payload", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const header = stripeHeader(payload, Math.floor(Date.now() / 1000));
    assert.equal(verifyStripeSignature(payload, header, SECRET), true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = stripeHeader(payload, Math.floor(Date.now() / 1000), "wrong_secret");
    assert.equal(verifyStripeSignature(payload, header, SECRET), false);
  });

  it("rejects a tampered payload (signature no longer matches)", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = stripeHeader(payload, Math.floor(Date.now() / 1000));
    const tamperedPayload = JSON.stringify({ id: "evt_2" });
    assert.equal(verifyStripeSignature(tamperedPayload, header, SECRET), false);
  });

  it("rejects a stale timestamp outside the tolerance window", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = stripeHeader(payload, Math.floor(Date.now() / 1000) - 600);
    assert.equal(verifyStripeSignature(payload, header, SECRET), false);
  });

  it("rejects a missing signature header", () => {
    assert.equal(verifyStripeSignature("{}", null, SECRET), false);
  });

  it("accepts when any v1 value in a multi-signature header matches (secret rotation)", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const timestamp = Math.floor(Date.now() / 1000);
    const validSig = createHmac("sha256", SECRET).update(`${timestamp}.${payload}`).digest("hex");
    const header = `t=${timestamp},v1=deadbeef,v1=${validSig}`;
    assert.equal(verifyStripeSignature(payload, header, SECRET), true);
  });
});

describe("parseStripeEvent", () => {
  it("parses a well-formed event", () => {
    const event = parseStripeEvent(JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } }));
    assert.ok(event);
    assert.equal(event?.type, "checkout.session.completed");
  });

  it("returns null for malformed JSON", () => {
    assert.equal(parseStripeEvent("not json"), null);
  });

  it("returns null when required fields are missing", () => {
    assert.equal(parseStripeEvent(JSON.stringify({ id: "evt_1" })), null);
  });
});
