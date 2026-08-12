import { OUTBOUND_TIMEOUT_MS } from "./outbound";
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

function describeWebhookError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logWebhookWarning(message: string, detail?: Record<string, unknown>): void {
  console.warn("[external-webhook]", message, detail ?? {});
}

export async function mirrorIntakeToExternalWebhook(payload: ExternalWebhookPayload): Promise<void> {
  const endpoint = process.env.INTAKE_EXTERNAL_WEBHOOK_URL;
  if (!endpoint || endpoint.includes("YOUR-WEBHOOK") || endpoint.includes("YOUR_WEBHOOK")) {
    return;
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    logWebhookWarning("Skipping invalid intake webhook URL.", {
      error: describeWebhookError(error),
    });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("intake webhook timeout"), OUTBOUND_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      logWebhookWarning("Intake webhook returned a non-2xx response.", {
        status: response.status,
        host: url.host,
      });
    }
  } catch (error) {
    // Intentionally do not throw — ingestion already persisted locally.
    logWebhookWarning("Intake webhook mirror failed.", {
      error: describeWebhookError(error),
      host: url.host,
    });
  } finally {
    clearTimeout(timer);
  }
}
