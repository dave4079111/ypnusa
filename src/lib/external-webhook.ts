import type { BorrowerAnswers, LoanProgram } from "./types";

export interface ExternalWebhookPayload {
  event: "intake.completed";
  receivedAt: string;
  borrowerLeadId: string;
  crmLeadId: string;
  sessionId?: string;
  loanProgram: LoanProgram;
  funnelSource: string;
  answers: BorrowerAnswers;
  qualification: unknown;
  assignedOfficer: { id: string; name: string; email: string };
  /** lets downstream systems tag source */
  ingestStack: "loanapilot_next";
}

const TIMEOUT_MS = 10_000;

export async function mirrorIntakeToExternalWebhook(payload: ExternalWebhookPayload): Promise<void> {
  const endpoint = process.env.INTAKE_EXTERNAL_WEBHOOK_URL;
  if (!endpoint || endpoint.includes("YOUR-WEBHOOK") || endpoint.includes("YOUR_WEBHOOK")) {
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    /** Intentionally quiet — ingestion already persisted locally */
  } finally {
    clearTimeout(timer);
  }
}
