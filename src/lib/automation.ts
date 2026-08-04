import { appendAnalytics, persistFollowUpsBatch, writeDb } from "./db";
import { generateId } from "./id";
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
      return 4_000;
    case "immediate_sms_ack":
      return 7_000;
    case "day_1_educational_email":
      return day;
    case "day_3_book_call_email":
      return day * 3;
    case "day_5_urgency_email":
      return day * 5;
    default:
      return day;
  }
}

const nurtureCopy: Record<FollowUpPlan, string> = {
  immediate_confirmation_email:
    "Thanks for trusting YPN USA—disclosures are staged and your loan officer inbox just lit up.",
  immediate_sms_ack:
    "SMS handshake fired (Twilio-compatible placeholder)—borrower can reply STOP any time.",
  day_1_educational_email:
    "Education drip: underwriting checklist + video explainer comparing term vs amortization deltas.",
  day_3_book_call_email:
    "Conversion nudge—highlight three live consultation blocks mirrored from LOS calendar placeholders.",
  day_5_urgency_email:
    "Momentum reminder—pair live pricing volatility with LOS-ready document requests.",
};

export function scheduleBorrowerJourney(
  borrowerLeadId: string,
  answers: BorrowerAnswers,
): ScheduledFollowUpRecord[] {
  const email = answers.email ?? "borrower-not-provided@loanapilot.ai";
  const phone = answers.phone ?? "+10005550199";

  const plans: FollowUpPlan[] = [
    "immediate_confirmation_email",
    "immediate_sms_ack",
    "day_1_educational_email",
    "day_3_book_call_email",
    "day_5_urgency_email",
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

export function processDueFollowUps(): {
  processed: number;
  events: string[];
} {
  let processed = 0;
  const events: string[] = [];

  writeDb((db) => {
    const now = Date.now();
    db.followUps.forEach((job) => {
      if (job.status !== "pending") return;
      if (new Date(job.scheduledAt).getTime() > now) return;
      job.status = "sent";
      job.sentAt = new Date().toISOString();
      processed += 1;
      events.push(`${job.plan}:${job.channel}`);
    });
  });

  if (processed > 0) {
    appendAnalytics({
      type: "followup_processed",
      payload: { processedCount: processed, previews: events },
    });
  }

  return { processed, events };
}
