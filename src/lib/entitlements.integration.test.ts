import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-entitlements-"));
const secret = "entitlement-sync-test-secret-over-thirty-two-bytes";
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.ENTITLEMENT_SYNC_SECRET = secret;

function signedRequest(payload: Record<string, unknown>): Request {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return new Request("http://localhost/api/webhooks/entitlements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-YPNUS-Timestamp": timestamp,
      "X-YPNUS-Signature": signature,
    },
    body,
  });
}

function event(eventId: string, status: string) {
  return {
    eventId,
    mlo: {
      id: "wp_88",
      name: "Production MLO",
      email: "mlo@example.com",
      company: "Production Lending",
      tier: "pro",
      status,
      stripeCustomerId: "cus_88",
      stripeSubscriptionId: "sub_88",
      claimedZips: ["93720"],
    },
  };
}

describe("Stripe entitlement synchronization", async () => {
  const { POST } = await import("../app/api/webhooks/entitlements/route");
  const { readDb, writeDb } = await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("persists active billing, deduplicates events, and revokes cancelled sessions", async () => {
    const active = await POST(signedRequest(event("evt_active", "active")));
    assert.equal(active.status, 200);
    assert.equal((await active.json()).duplicate, false);
    assert.equal(
      readDb().revenueSubscriptions.find(
        (subscription) => subscription.stripeSubscriptionId === "sub_88",
      )?.source,
      "stripe",
    );

    const duplicate = await POST(signedRequest(event("evt_active", "active")));
    assert.equal((await duplicate.json()).duplicate, true);

    writeDb((db) => {
      db.authSessions.push({
        idHash: "session-hash",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        profile: {
          id: "wp_88",
          name: "Production MLO",
          email: "mlo@example.com",
          paidAccess: true,
          subscriptionStatus: "active",
          isAdmin: false,
          subscriptionTier: "pro",
          stripeCustomerId: "cus_88",
          stripeSubscriptionId: "sub_88",
          claimedZips: ["93720"],
        },
      });
    });

    const cancelled = await POST(signedRequest(event("evt_cancelled", "canceled")));
    assert.equal(cancelled.status, 200);
    const db = readDb();
    assert.equal(
      db.revenueSubscriptions.find(
        (subscription) => subscription.stripeSubscriptionId === "sub_88",
      )?.status,
      "cancelled",
    );
    assert.equal(db.authSessions.length, 0);
  });

  it("rejects invalid signatures", async () => {
    const request = signedRequest(event("evt_bad_signature", "active"));
    request.headers.set("X-YPNUS-Signature", "0".repeat(64));
    const response = await POST(request);
    assert.equal(response.status, 401);
  });
});
