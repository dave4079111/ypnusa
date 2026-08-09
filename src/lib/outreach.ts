import type {
  BorrowerLeadRecord,
  FollowUpPlan,
  LoanOfficerRecord,
  ScheduledFollowUpRecord,
} from "./types";

const REQUEST_TIMEOUT_MS = 8_000;

export interface OutreachContext {
  lead: BorrowerLeadRecord;
  officer: LoanOfficerRecord;
}

export interface OutreachDeliveryResult {
  provider: "twilio" | "sendgrid" | "webhook" | "demo";
  messageId?: string;
}

const outreachCopy: Record<FollowUpPlan, (firstName: string, officerName: string) => string> = {
  immediate_confirmation_email: (firstName, officerName) =>
    `Hi ${firstName}, I’m the YPN USA virtual assistant for ${officerName}. I received your mortgage request and can help you choose a time for a quick call.`,
  immediate_sms_ack: (firstName, officerName) =>
    `Hi ${firstName} — I’m the YPN USA virtual assistant for ${officerName}. I received your mortgage request and can help schedule a call. Reply STOP to opt out.`,
  day_1_educational_email: (firstName, officerName) =>
    `Hi ${firstName}, ${officerName} is ready to help. Reply with any mortgage questions or choose an available consultation time in your YPN USA conversation.`,
  day_3_book_call_email: (firstName, officerName) =>
    `Hi ${firstName}, would you like to reserve a short call with ${officerName}? Your YPN USA assistant can show current openings.`,
  day_5_urgency_email: (firstName, officerName) =>
    `Hi ${firstName}, timing and rates can change quickly. ${officerName} can review your options whenever you are ready.`,
  day_30_check_in: (firstName, officerName) =>
    `Hi ${firstName}, checking in from ${officerName}’s YPN USA team. Has your home financing timeline changed in the last month?`,
  day_60_check_in: (firstName, officerName) =>
    `Hi ${firstName}, are you any closer to a purchase or refinance decision? ${officerName} can refresh your options and next steps.`,
  day_90_check_in: (firstName, officerName) =>
    `Hi ${firstName}, this is your 90-day YPN USA check-in. Reply if you would like ${officerName} to prepare an updated mortgage game plan.`,
};

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

export function composeOutreach(
  plan: FollowUpPlan,
  context: OutreachContext,
): { subject: string; body: string } {
  return {
    subject: `Your mortgage next steps with ${context.officer.name}`,
    body: outreachCopy[plan](firstName(context.lead.answers.name), context.officer.name),
  };
}

async function responseMessageId(response: Response): Promise<string | undefined> {
  const headerId =
    response.headers.get("x-message-id") ??
    response.headers.get("x-request-id") ??
    response.headers.get("location");
  if (headerId) return headerId;

  try {
    const body = (await response.json()) as { sid?: string; id?: string };
    return body.sid ?? body.id;
  } catch {
    return undefined;
  }
}

async function assertSuccessful(response: Response, provider: string): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 300);
  throw new Error(`${provider} rejected outreach (${response.status}): ${detail || response.statusText}`);
}

async function deliverWebhook(
  job: ScheduledFollowUpRecord,
  context: OutreachContext,
  subject: string,
  body: string,
  url: string,
): Promise<OutreachDeliveryResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "borrower.outreach",
      followUpId: job.id,
      borrowerLeadId: job.borrowerLeadId,
      assignedMlo: {
        id: context.officer.id,
        name: context.officer.name,
        email: context.officer.email,
      },
      channel: job.channel,
      recipient: job.recipient,
      plan: job.plan,
      subject,
      body,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await assertSuccessful(response, "Outreach webhook");
  return { provider: "webhook", messageId: await responseMessageId(response) };
}

async function deliverTwilio(
  job: ScheduledFollowUpRecord,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<OutreachDeliveryResult> {
  const form = new URLSearchParams({ To: job.recipient, From: fromNumber, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  await assertSuccessful(response, "Twilio");
  return { provider: "twilio", messageId: await responseMessageId(response) };
}

async function deliverSendGrid(
  job: ScheduledFollowUpRecord,
  subject: string,
  body: string,
  apiKey: string,
  fromEmail: string,
): Promise<OutreachDeliveryResult> {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: job.recipient }] }],
      from: { email: fromEmail, name: "YPN USA" },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await assertSuccessful(response, "SendGrid");
  return { provider: "sendgrid", messageId: await responseMessageId(response) };
}

export async function deliverOutreach(
  job: ScheduledFollowUpRecord,
  context: OutreachContext,
): Promise<OutreachDeliveryResult> {
  const { subject, body } = composeOutreach(job.plan, context);
  const webhookUrl = process.env.OUTREACH_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    return deliverWebhook(job, context, subject, body, webhookUrl);
  }

  if (job.channel === "sms") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    if (accountSid && authToken && fromNumber) {
      return deliverTwilio(job, body, accountSid, authToken, fromNumber);
    }
  } else {
    const apiKey = process.env.SENDGRID_API_KEY?.trim();
    const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
    if (apiKey && fromEmail) {
      return deliverSendGrid(job, subject, body, apiKey, fromEmail);
    }
  }

  return { provider: "demo", messageId: `demo_${job.id}` };
}
