import { appendCrmNote, cancelPendingFollowUps, readDb } from "./db";
import { processDueFollowUps } from "./automation";
import { notifyAssignedOfficer } from "./notifications";
import { listSyncedAvailableSlots } from "./calendar";
import type { AgentAction, AgentActionExecutor, AgentActionResult, AgentContext } from "./agent-types";

/**
 * Concrete adapter for src/lib/agent-actions.ts's executeAgentAction — the
 * "adapters own those integrations" boundary the type contract calls for.
 * Every branch below calls existing, already-tested functions; nothing here
 * introduces new business logic beyond wiring an AgentAction to it.
 */

function ok(actionId: string, message: string, data?: Record<string, unknown>): AgentActionResult {
  return { ok: true, actionId, message, data };
}

function fail(actionId: string, message: string): AgentActionResult {
  return { ok: false, actionId, message };
}

/** Intake-time-only actions: unreachable once a lead is past qualifying, but handled for completeness. */
function notApplicablePostIntake(action: AgentAction): AgentActionResult {
  return ok(
    action.id,
    `${action.kind} is handled by the live conversational intake flow, not the post-completion executor.`,
  );
}

export const defaultAgentExecutor: AgentActionExecutor = async (
  action: AgentAction,
  context: AgentContext,
): Promise<AgentActionResult> => {
  const borrowerLeadId = context.state.leadId ?? context.borrowerLead?.id;

  switch (action.kind) {
    case "ask_question":
    case "clarify_answer":
    case "qualify_lead":
      return notApplicablePostIntake(action);

    case "route_lead": {
      if (!borrowerLeadId) return fail(action.id, "No borrower lead id on the agent state.");
      const lead = readDb().borrowerLeads.find((item) => item.id === borrowerLeadId);
      if (!lead) return fail(action.id, "Borrower lead record was not found.");
      return ok(action.id, `Lead is routed to loan officer ${lead.assignedLoId}.`, {
        assignedLoId: lead.assignedLoId,
      });
    }

    case "send_email":
    case "send_sms": {
      if (!borrowerLeadId) return fail(action.id, "No borrower lead id on the agent state.");
      const channel = action.kind === "send_email" ? "email" : "sms";
      const pending = readDb().followUps.find(
        (job) => job.borrowerLeadId === borrowerLeadId && job.channel === channel && job.status === "pending",
      );
      if (!pending) {
        return fail(action.id, `No pending ${channel} follow-up is queued for this lead to send.`);
      }
      const summary = await processDueFollowUps({ borrowerLeadId, limit: 1 });
      if (summary.processed < 1) {
        return fail(action.id, `Queued ${channel} follow-up did not send (see followUps[].lastError).`);
      }
      return ok(action.id, `Sent the next queued ${channel} follow-up (${pending.plan}).`, {
        plan: pending.plan,
      });
    }

    case "create_followup": {
      if (!borrowerLeadId) return fail(action.id, "No borrower lead id on the agent state.");
      const summary = await processDueFollowUps({ borrowerLeadId, limit: 1 });
      if (summary.processed < 1 && summary.failed < 1) {
        return ok(action.id, "No follow-up is currently due; nothing to send yet.");
      }
      return ok(action.id, `Processed the next due follow-up (sent: ${summary.processed}, failed: ${summary.failed}).`);
    }

    case "cancel_followups": {
      if (!borrowerLeadId) return fail(action.id, "No borrower lead id on the agent state.");
      const cancelled = cancelPendingFollowUps(borrowerLeadId);
      return ok(action.id, `Cancelled ${cancelled} pending follow-up(s).`, { cancelled });
    }

    case "book_appointment": {
      if (!context.borrowerLead) return fail(action.id, "No borrower lead on context to offer slots for.");
      const slots = await listSyncedAvailableSlots(context.borrowerLead.assignedLoId, 14);
      if (slots.length === 0) {
        return fail(action.id, "No available appointment slots to offer right now.");
      }
      return ok(action.id, `${slots.length} appointment slot(s) available to offer the borrower.`, {
        slots: slots.slice(0, 5),
      });
    }

    case "add_crm_note": {
      if (!borrowerLeadId) return fail(action.id, "No borrower lead id on the agent state.");
      const note = typeof action.payload.note === "string" ? action.payload.note : action.reason;
      const added = appendCrmNote(borrowerLeadId, `Agent ▸ ${note}`);
      if (!added) return fail(action.id, "No CRM lead record exists for this borrower yet.");
      return ok(action.id, "Note added to the CRM lead record.");
    }

    case "alert_mlo":
    case "escalate_to_mlo": {
      if (!context.borrowerLead) return fail(action.id, "No borrower lead on context to alert an MLO about.");
      const lead = context.borrowerLead;
      notifyAssignedOfficer({
        loId: lead.assignedLoId,
        borrowerLeadId: lead.id,
        loanProgram: lead.answers.loanProgram,
        answers: lead.answers,
        qualification: lead.qualification,
      });
      return ok(action.id, `Alerted loan officer ${lead.assignedLoId}.`);
    }

    case "wait":
      return ok(action.id, "No action needed right now.");

    default: {
      const exhaustive: never = action.kind;
      return fail(action.id, `Unhandled agent action kind: ${exhaustive}`);
    }
  }
};
