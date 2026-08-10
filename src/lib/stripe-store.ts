import { readDb, writeDb } from "./db";
import { generateId } from "./id";
import type {
  AppAccountRecord,
  StripeSubscriptionStatus,
} from "./types";

export type StripeEventClaim = "claimed" | "duplicate";

const EVENT_LOCK_STALE_MS = 10 * 60 * 1000;

export function claimStripeEvent(eventId: string, type: string): StripeEventClaim {
  let claim: StripeEventClaim = "duplicate";
  writeDb((db) => {
    const now = new Date();
    const existing = db.stripeEvents.find((event) => event.eventId === eventId);
    if (existing) {
      if (
        existing.status === "processing" &&
        Date.parse(existing.updatedAt) <= now.getTime() - EVENT_LOCK_STALE_MS
      ) {
        existing.type = type;
        existing.updatedAt = now.toISOString();
        claim = "claimed";
      }
      return;
    }
    db.stripeEvents.push({
      eventId,
      type,
      status: "processing",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    claim = "claimed";
  });
  return claim;
}

export function completeStripeEvent(eventId: string): void {
  writeDb((db) => {
    const event = db.stripeEvents.find((candidate) => candidate.eventId === eventId);
    if (!event) throw new Error("Stripe event lock is missing.");
    event.status = "completed";
    event.updatedAt = new Date().toISOString();
  });
}

export function releaseStripeEvent(eventId: string): void {
  writeDb((db) => {
    db.stripeEvents = db.stripeEvents.filter((event) => event.eventId !== eventId);
  });
}

interface CheckoutAccountInput {
  email: string;
  name?: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: AppAccountRecord["tier"];
}

function paidAccess(status: StripeSubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export function upsertStripeCheckoutAccount(input: CheckoutAccountInput): AppAccountRecord {
  let output: AppAccountRecord | undefined;
  writeDb((db) => {
    const matches = [
      db.appAccounts.find((account) => account.stripeCustomerId === input.stripeCustomerId),
      db.appAccounts.find(
        (account) => account.stripeSubscriptionId === input.stripeSubscriptionId,
      ),
      db.appAccounts.find(
        (account) => account.email.toLowerCase() === input.email.toLowerCase(),
      ),
    ].filter((account): account is AppAccountRecord => Boolean(account));
    const ids = new Set(matches.map((account) => account.id));
    if (ids.size > 1) throw new Error("Stripe account mapping conflict.");

    const now = new Date().toISOString();
    const account = matches[0];
    if (account) {
      if (
        (account.stripeCustomerId &&
          account.stripeCustomerId !== input.stripeCustomerId) ||
        (account.stripeSubscriptionId &&
          account.stripeSubscriptionId !== input.stripeSubscriptionId)
      ) {
        throw new Error("Stripe account mapping conflict.");
      }
      account.email = input.email;
      account.name = input.name ?? account.name;
      account.stripeCustomerId = input.stripeCustomerId;
      account.stripeSubscriptionId = input.stripeSubscriptionId;
      account.tier = input.tier;
      account.subscriptionStatus = "active";
      account.paidAccess = true;
      account.updatedAt = now;
      output = structuredClone(account);
      return;
    }

    const created: AppAccountRecord = {
      id: generateId("acct"),
      createdAt: now,
      updatedAt: now,
      email: input.email,
      name: input.name,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      tier: input.tier,
      subscriptionStatus: "active",
      paidAccess: true,
    };
    db.appAccounts.push(created);
    output = structuredClone(created);
  });
  if (!output) throw new Error("Stripe account could not be persisted.");
  return output;
}

interface LifecycleUpdateInput {
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: StripeSubscriptionStatus;
  tier?: AppAccountRecord["tier"];
}

export function updateStripeAccountLifecycle(
  input: LifecycleUpdateInput,
): AppAccountRecord {
  let output: AppAccountRecord | undefined;
  writeDb((db) => {
    const bySubscription = input.stripeSubscriptionId
      ? db.appAccounts.find(
          (account) => account.stripeSubscriptionId === input.stripeSubscriptionId,
        )
      : undefined;
    const byCustomer = db.appAccounts.find(
      (account) => account.stripeCustomerId === input.stripeCustomerId,
    );
    if (bySubscription && byCustomer && bySubscription.id !== byCustomer.id) {
      throw new Error("Stripe lifecycle mapping conflict.");
    }
    const account = bySubscription ?? byCustomer;
    if (!account) throw new Error("Stripe lifecycle account was not found.");
    if (
      input.stripeSubscriptionId &&
      account.stripeSubscriptionId !== input.stripeSubscriptionId
    ) {
      throw new Error("Stripe lifecycle subscription does not match the account.");
    }

    account.subscriptionStatus = input.subscriptionStatus;
    account.paidAccess = paidAccess(input.subscriptionStatus);
    if (input.tier) account.tier = input.tier;
    account.updatedAt = new Date().toISOString();
    output = structuredClone(account);
  });
  if (!output) throw new Error("Stripe lifecycle update could not be persisted.");
  return output;
}

export function stripeStoreSnapshot() {
  const db = readDb();
  return {
    events: db.stripeEvents,
    accounts: db.appAccounts,
  };
}
