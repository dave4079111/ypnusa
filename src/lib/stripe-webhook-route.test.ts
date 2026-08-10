import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import Stripe from "stripe";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-stripe-node-"));
const webhookSecret = "whsec_node_integration_test";
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

const stripe = new Stripe("sk_test_webhook_tests_only", { telemetry: false });

describe("Node Stripe webhook route", async () => {
  const { POST } = await import("../app/api/webhooks/stripe/route");
  const { writeDb } = await import("./db");
  const { stripeStoreSnapshot } = await import("./stripe-store");

  beforeEach(() => {
    writeDb((db) => {
      db.stripeEvents = [];
      db.appAccounts = [];
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  function checkoutEvent(
    overrides: Record<string, unknown> = {},
    eventId = "evt_checkout_paid",
  ) {
    return {
      id: eventId,
      object: "event",
      created: Math.floor(Date.now() / 1000),
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid",
          object: "checkout.session",
          mode: "subscription",
          payment_status: "paid",
          customer: "cus_mlo",
          subscription: "sub_mlo",
          customer_email: "mlo@example.com",
          customer_details: {
            email: "mlo@example.com",
            name: "Morgan MLO",
          },
          metadata: { ypnus_tier: "pro" },
          ...overrides,
        },
      },
    };
  }

  async function deliver(
    event: Record<string, unknown>,
    options: { signature?: string; timestamp?: number; payload?: string } = {},
  ) {
    const payload = options.payload ?? JSON.stringify(event);
    const signature =
      options.signature ??
      stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
        timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
      });
    return POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: payload,
      }),
    );
  }

  it("fails closed when the webhook signing secret is not configured", async () => {
    const configured = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const response = await deliver(checkoutEvent());
      assert.equal(response.status, 503);
      assert.equal(stripeStoreSnapshot().events.length, 0);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = configured;
    }
  });

  it("rejects invalid and stale signatures without writing event locks", async () => {
    const event = checkoutEvent();
    const invalid = await deliver(event, {
      signature: "t=1900000000,v1=invalid",
    });
    assert.equal(invalid.status, 400);
    assert.equal(stripeStoreSnapshot().events.length, 0);

    const stale = await deliver(event, {
      timestamp: Math.floor(Date.now() / 1000) - 301,
    });
    assert.equal(stale.status, 400);
    assert.equal(stripeStoreSnapshot().events.length, 0);
  });

  it("fails closed for unknown tiers and unpaid sessions before claiming", async () => {
    const unknownTier = await deliver(
      checkoutEvent({ metadata: { ypnus_tier: "enterprise" } }, "evt_unknown_tier"),
    );
    assert.equal(unknownTier.status, 400);

    const unpaid = await deliver(
      checkoutEvent({ payment_status: "unpaid" }, "evt_unpaid"),
    );
    assert.equal(unpaid.status, 400);
    const snapshot = stripeStoreSnapshot();
    assert.equal(snapshot.events.length, 0);
    assert.equal(snapshot.accounts.length, 0);
  });

  it("provisions a paid checkout and acknowledges its replay once", async () => {
    const event = checkoutEvent();
    const first = await deliver(event);
    const firstBody = (await first.json()) as { ok: boolean; duplicate: boolean };
    assert.equal(first.status, 200);
    assert.equal(firstBody.ok, true);
    assert.equal(firstBody.duplicate, false);

    const snapshot = stripeStoreSnapshot();
    assert.equal(snapshot.events.length, 1);
    assert.equal(snapshot.events[0]?.status, "completed");
    assert.equal(snapshot.accounts.length, 1);
    assert.equal(snapshot.accounts[0]?.email, "mlo@example.com");
    assert.equal(snapshot.accounts[0]?.stripeCustomerId, "cus_mlo");
    assert.equal(snapshot.accounts[0]?.stripeSubscriptionId, "sub_mlo");
    assert.equal(snapshot.accounts[0]?.tier, "pro");
    assert.equal(snapshot.accounts[0]?.subscriptionStatus, "active");

    const duplicate = await deliver(event);
    const duplicateBody = (await duplicate.json()) as {
      ok: boolean;
      duplicate: boolean;
    };
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.duplicate, true);
    assert.equal(stripeStoreSnapshot().accounts.length, 1);
  });

  it("synchronizes subscription updates, payment failures, and deletion", async () => {
    assert.equal((await deliver(checkoutEvent())).status, 200);

    const updated = {
      id: "evt_subscription_past_due",
      object: "event",
      created: Math.floor(Date.now() / 1000),
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_mlo",
          object: "subscription",
          customer: "cus_mlo",
          status: "past_due",
          metadata: { ypnus_tier: "pro" },
        },
      },
    };
    assert.equal((await deliver(updated)).status, 200);
    assert.equal(stripeStoreSnapshot().accounts[0]?.subscriptionStatus, "past_due");
    assert.equal(stripeStoreSnapshot().accounts[0]?.paidAccess, false);

    const invoiceFailed = {
      id: "evt_invoice_failed",
      object: "event",
      created: Math.floor(Date.now() / 1000),
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_failed",
          object: "invoice",
          customer: "cus_mlo",
          parent: {
            subscription_details: {
              subscription: "sub_mlo",
            },
          },
        },
      },
    };
    assert.equal((await deliver(invoiceFailed)).status, 200);
    assert.equal(stripeStoreSnapshot().accounts[0]?.subscriptionStatus, "past_due");

    const deleted = {
      id: "evt_subscription_deleted",
      object: "event",
      created: Math.floor(Date.now() / 1000),
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_mlo",
          object: "subscription",
          customer: "cus_mlo",
          status: "canceled",
          metadata: { ypnus_tier: "pro" },
        },
      },
    };
    assert.equal((await deliver(deleted)).status, 200);
    assert.equal(stripeStoreSnapshot().accounts[0]?.subscriptionStatus, "canceled");
    assert.equal(stripeStoreSnapshot().accounts[0]?.paidAccess, false);
  });

  it("releases the event lock when lifecycle persistence fails", async () => {
    const missingAccountEvent = {
      id: "evt_missing_account",
      object: "event",
      created: Math.floor(Date.now() / 1000),
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_missing",
          object: "subscription",
          customer: "cus_missing",
          status: "active",
          metadata: { ypnus_tier: "starter" },
        },
      },
    };
    const response = await deliver(missingAccountEvent);
    assert.equal(response.status, 500);
    assert.equal(
      stripeStoreSnapshot().events.some(
        (event) => event.eventId === "evt_missing_account",
      ),
      false,
    );
  });
});
