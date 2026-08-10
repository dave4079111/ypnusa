import { createHash } from "node:crypto";
import { writeDb } from "./db";
import type { PricingTierId } from "./pricing";
import type {
  LoanOfficerRecord,
  LoanProgram,
  RevenueSubscriptionRecord,
} from "./types";

const ALL_PROGRAMS: LoanProgram[] = [
  "FHA",
  "VA",
  "CONVENTIONAL",
  "DSCR",
  "HELOC",
  "REFI",
  "JUMBO",
];

type PaidTier = Exclude<PricingTierId, "free">;
type EntitlementStatus = "trialing" | "active" | "past_due" | "cancelled";

export interface EntitlementSyncInput {
  eventId: string;
  mlo: {
    id: string;
    name: string;
    email: string;
    company?: string;
    tier: PaidTier;
    status: EntitlementStatus;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    claimedZips: string[];
  };
}

function text(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

export function parseEntitlementSync(value: unknown): EntitlementSyncInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.mlo !== "object" || body.mlo === null || Array.isArray(body.mlo)) return null;
  const mlo = body.mlo as Record<string, unknown>;
  const eventId = text(body.eventId, 255);
  const id = text(mlo.id, 160);
  const name = text(mlo.name, 160);
  const email = text(mlo.email, 320)?.toLowerCase();
  const tier = text(mlo.tier, 20);
  const rawStatus = text(mlo.status, 30);
  const status = rawStatus === "canceled" ? "cancelled" : rawStatus;
  const stripeCustomerId = text(mlo.stripeCustomerId, 255);
  const stripeSubscriptionId = text(mlo.stripeSubscriptionId, 255);
  if (
    !eventId ||
    !id ||
    !name ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (tier !== "starter" && tier !== "pro" && tier !== "elite") ||
    (status !== "active" &&
      status !== "trialing" &&
      status !== "past_due" &&
      status !== "cancelled") ||
    !stripeCustomerId ||
    !stripeSubscriptionId
  ) {
    return null;
  }
  const claimedZips = Array.isArray(mlo.claimedZips)
    ? [...new Set(mlo.claimedZips)]
        .filter((zip): zip is string => typeof zip === "string")
        .map((zip) => zip.trim())
        .filter((zip) => /^\d{5}$/.test(zip))
        .slice(0, 500)
    : [];
  return {
    eventId,
    mlo: {
      id,
      name,
      email,
      company: text(mlo.company, 160),
      tier,
      status,
      stripeCustomerId,
      stripeSubscriptionId,
      claimedZips,
    },
  };
}

export function applyEntitlementSync(input: EntitlementSyncInput): { duplicate: boolean } {
  let duplicate = false;
  const now = new Date().toISOString();
  writeDb((db) => {
    if (db.processedEntitlementEvents.some((event) => event.eventId === input.eventId)) {
      duplicate = true;
      return;
    }

    const officerIndex = db.loanOfficers.findIndex((officer) => officer.id === input.mlo.id);
    const existingOfficer =
      officerIndex >= 0 ? db.loanOfficers[officerIndex] : undefined;
    const officer: LoanOfficerRecord = {
      id: input.mlo.id,
      name: input.mlo.name,
      email: input.mlo.email,
      specialties: existingOfficer?.specialties ?? ALL_PROGRAMS,
      weeklyWindows:
        existingOfficer?.weeklyWindows ??
        [1, 2, 3, 4, 5].map((dow) => ({
          dow,
          startMin: 9 * 60,
          endMin: 17 * 60,
        })),
      calendarProvider: existingOfficer?.calendarProvider,
      calendarId: existingOfficer?.calendarId,
      calendarTimeZone: existingOfficer?.calendarTimeZone,
      calendlyUrl: existingOfficer?.calendlyUrl,
    };
    if (officerIndex >= 0) db.loanOfficers[officerIndex] = officer;
    else db.loanOfficers.push(officer);

    const subscriptionIndex = db.revenueSubscriptions.findIndex(
      (subscription) =>
        subscription.stripeSubscriptionId === input.mlo.stripeSubscriptionId,
    );
    const existing =
      subscriptionIndex >= 0 ? db.revenueSubscriptions[subscriptionIndex] : undefined;
    const subscription: RevenueSubscriptionRecord = {
      id:
        existing?.id ??
        `sub_stripe_${createHash("sha256")
          .update(input.mlo.stripeSubscriptionId)
          .digest("hex")
          .slice(0, 24)}`,
      createdAt: existing?.createdAt ?? now,
      startedAt: existing?.startedAt ?? now,
      tier: input.mlo.tier,
      status: input.mlo.status,
      source: "stripe",
      stripeCustomerId: input.mlo.stripeCustomerId,
      stripeSubscriptionId: input.mlo.stripeSubscriptionId,
      ownerLoId: input.mlo.id,
      ownerEmail: input.mlo.email,
      company: input.mlo.company,
      claimedZips: input.mlo.claimedZips,
    };
    if (subscriptionIndex >= 0) db.revenueSubscriptions[subscriptionIndex] = subscription;
    else db.revenueSubscriptions.push(subscription);

    if (input.mlo.status !== "active" && input.mlo.status !== "trialing") {
      db.authSessions = db.authSessions.filter(
        (session) => session.profile.id !== input.mlo.id,
      );
    }
    db.processedEntitlementEvents.push({ eventId: input.eventId, processedAt: now });
    if (db.processedEntitlementEvents.length > 10_000) {
      db.processedEntitlementEvents.splice(
        0,
        db.processedEntitlementEvents.length - 10_000,
      );
    }
  });
  return { duplicate };
}
