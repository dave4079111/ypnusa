import { appendAnalytics, persistFollowUpsBatch, readDb, writeDb } from "./db";
import { generateId } from "./id";
import { deliverOutreach } from "./outreach";
import type {
  BorrowerAnswers,
  FollowUpPlan,
  ScheduledFollowUpRecord,
} from "./types";

export function demoDayMilliseconds(): number {
  if (process.env.LOANPILOT_DEMO_MODE === "1") {
    /** Two minutes substitutes for twenty-four hours in investor demos */
    return 120_000;
  }

  const minutes = Number(process.env.LOANPILOT_DEMO_DAY_MINUTES ?? "");
  if (Number.isFinite(minutes) && minutes > 0) {
    return minutes * 60_000;
  }

  return 86_400_000;
}

function offsetSinceNow(plan: FollowUpPlan): number {
  const day = demoDayMilliseconds();

  switch (plan) {
    case "immediate_confirmation_email":
    case "immediate_sms_ack":
      return 0;
    case "day_1_educational_email":
      return day;
    case "day_3_book_call_email":
      return day * 3;
    case "day_5_urgency_email":
      return day * 5;
    case "day_30_check_in":
      return day * 30;
    case "day_60_check_in":
      return day * 60;
    case "day_90_check_in":
      return day * 90;
    default:
      return plan satisfies never;
  }
}

const nurtureCopy: Record<FollowUpPlan, string> = {
  immediate_confirmation_email:
    "Thanks for trusting YPN USA—disclosures are staged and your loan officer inbox just lit up.",
  immediate_sms_ack:
    "SMS confirmation sent with compliant opt-out instructions.",
  day_1_educational_email:
    "Education drip: underwriting checklist + video explainer comparing term vs amortization deltas.",
  day_3_book_call_email:
    "Conversion nudge with the MLO's synchronized consultation availability.",
  day_5_urgency_email:
    "Momentum reminder—pair live pricing volatility with LOS-ready document requests.",
  day_30_check_in: "30-day borrower readiness check-in.",
  day_60_check_in: "60-day purchase or refinance timeline check-in.",
  day_90_check_in: "90-day mortgage game-plan refresh.",
};

export function scheduleBorrowerJourney(
  borrowerLeadId: string,
  answers: BorrowerAnswers,
): ScheduledFollowUpRecord[] {
  if (answers.contactConsent !== true) return [];
  if (!answers.email || !answers.phone) return [];

  const email = answers.email;
  const phone = answers.phone;

  const plans: FollowUpPlan[] = [
    "immediate_confirmation_email",
    "immediate_sms_ack",
    "day_1_educational_email",
    "day_3_book_call_email",
    "day_5_urgency_email",
    "day_30_check_in",
    "day_60_check_in",
    "day_90_check_in",
  ];

  const anchor = Date.now();
  const created: ScheduledFollowUpRecord[] = plans.map((plan) => ({
    id: generateId("fu"),
    borrowerLeadId,
    plan,
    channel: plan === "immediate_sms_ack" ? "sms" : "email",
    recipient: plan === "immediate_sms_ack" ? phone : email,
    scheduledAt: new Date(anchor + offsetSinceNow(plan)).toISOString(),
    status: "pending",
    bodySummary: nurtureCopy[plan],
    createdAt: new Date().toISOString(),
  }));

  persistFollowUpsBatch(created);
  return created;
}

export async function processDueFollowUps(options?: {
  borrowerLeadId?: string;
  limit?: number;
}): Promise<{
  processed: number;
  failed: number;
  events: string[];
}> {
  let processed = 0;
  let failed = 0;
  const events: string[] = [];
  const claimedIds: string[] = [];
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 100));

  writeDb((db) => {
    const now = Date.now();
    for (const job of db.followUps) {
      if (claimedIds.length >= limit) break;
      if (job.status !== "pending") continue;
      if (options?.borrowerLeadId && job.borrowerLeadId !== options.borrowerLeadId) continue;
      if (new Date(job.scheduledAt).getTime() > now) continue;
      job.status = "sending";
      job.attemptCount = (job.attemptCount ?? 0) + 1;
      claimedIds.push(job.id);
    }
  });

  for (const jobId of claimedIds) {
    const snapshot = readDb();
    const job = snapshot.followUps.find((item) => item.id === jobId);
    const lead = job
      ? snapshot.borrowerLeads.find((item) => item.id === job.borrowerLeadId)
      : undefined;
    const officer = lead
      ? snapshot.loanOfficers.find((item) => item.id === lead.assignedLoId)
      : undefined;

    if (!job || !lead || !officer) {
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        current.status = "failed";
        current.lastError = "Lead or assigned MLO context is missing.";
      });
      failed += 1;
      continue;
    }

    try {
      const delivery = await deliverOutreach(job, { lead, officer });
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        current.status = "sent";
        current.sentAt = new Date().toISOString();
        current.deliveryProvider = delivery.provider;
        current.providerMessageId = delivery.messageId;
        current.lastError = undefined;
      });
      processed += 1;
      events.push(`${job.plan}:${job.channel}:${delivery.provider}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outreach delivery failure.";
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        const attempts = current.attemptCount ?? 1;
        current.status = attempts >= 3 ? "failed" : "pending";
        current.scheduledAt = new Date(Date.now() + attempts * 60_000).toISOString();
        current.lastError = message.slice(0, 500);
      });
      failed += 1;
      events.push(`${job.plan}:${job.channel}:failed`);
    }
  }

  if (processed > 0) {
    appendAnalytics({
      type: "followup_processed",
      payload: { processedCount: processed, failedCount: failed, previews: events },
    });
  }

  return { processed, failed, events };
}
