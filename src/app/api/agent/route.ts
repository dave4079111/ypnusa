import { NextResponse } from "next/server";
import { runAgent, runPredictLeadForZip, type AgentTask, type AgentTaskType } from "@/lib/agents/coreAgent";
import { scoreLead, type Lead } from "@/lib/agents/predictiveAgent";
import { buildZipContext } from "@/lib/agents/zipContext";
import { buildCountyEvents } from "@/lib/agents/countyEvents";
import type { BorrowerProfile, BorrowerProfileBasics } from "@/lib/borrower/profileEngine";
import type { FunnelStageName } from "@/lib/predictive/outcomeEngine";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { requireSessionOrSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TASK_TYPES = new Set<AgentTaskType>([
  "predict-lead",
  "marketing-generate",
  "gmb-generate",
  "website-build-page",
  "zip-suggest-territory",
  "zip-score",
  "zip-explain",
  "marketing-social-post",
  "marketing-email",
  "marketing-ad-copy",
  "gmb-post",
  "gmb-optimize-description",
  "website-page-spec",
  "website-landing-page",
  "borrower-profile",
  "predict-outcome",
]);

export async function POST(request: Request) {
  const unauthorized = await requireSessionOrSecret(request);
  if (unauthorized) return unauthorized;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);

  const body = parsed.data;
  if (!isRecord(body) || typeof body.type !== "string") {
    return jsonError("Body must include a known task type.", 400, "INVALID_TASK_TYPE");
  }

  try {
    // Convenience path: client only has {lead, zip}; ZipContext/CountyEvents are
    // built server-side from live data sources before running the predict-lead task.
    if (body.type === "predict-lead-by-zip") {
      if (!isRecord(body.lead) || typeof body.zip !== "string") {
        return jsonError("predict-lead-by-zip requires { lead, zip }.", 400, "INVALID_TASK_TYPE");
      }
      const result = await runPredictLeadForZip(body.lead as unknown as Lead, body.zip);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    // Convenience path: client only has borrower basics; ZipContext/CountyEvents (and,
    // when a lead is supplied, PredictiveResult) are built server-side.
    if (body.type === "borrower-profile-by-zip") {
      if (!isRecord(body.borrower) || typeof body.borrower.zip !== "string") {
        return jsonError("borrower-profile-by-zip requires { borrower: { zip, ... } }.", 400, "INVALID_TASK_TYPE");
      }
      const zipContext = await buildZipContext(body.borrower.zip);
      const countyEvents = await buildCountyEvents(zipContext.county);
      const lead = isRecord(body.lead) ? (body.lead as unknown as Lead) : null;
      const predictive = lead ? scoreLead(lead, zipContext, countyEvents) : undefined;
      const result = await runAgent({
        type: "borrower-profile",
        input: { borrower: body.borrower as unknown as BorrowerProfileBasics, zipContext, countyEvents, predictive },
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    // Convenience path: client only has {lead, zip} (+ optional borrowerProfile/funnelStage);
    // ZipContext/CountyEvents/PredictiveResult are built server-side.
    if (body.type === "predict-outcome-by-zip") {
      if (!isRecord(body.lead) || typeof body.zip !== "string") {
        return jsonError("predict-outcome-by-zip requires { lead, zip }.", 400, "INVALID_TASK_TYPE");
      }
      const zipContext = await buildZipContext(body.zip);
      const countyEvents = await buildCountyEvents(zipContext.county);
      const predictive = scoreLead(body.lead as unknown as Lead, zipContext, countyEvents);
      const result = await runAgent({
        type: "predict-outcome",
        input: {
          zipContext,
          countyEvents,
          predictive,
          borrowerProfile: isRecord(body.borrowerProfile)
            ? (body.borrowerProfile as unknown as BorrowerProfile)
            : undefined,
          funnelStage: typeof body.funnelStage === "string" ? (body.funnelStage as FunnelStageName) : undefined,
        },
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    if (!VALID_TASK_TYPES.has(body.type as AgentTaskType)) {
      return jsonError("Body must include a known task type.", 400, "INVALID_TASK_TYPE");
    }

    const result = await runAgent(body as unknown as AgentTask);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    logApiError("/api/agent", error);
    return jsonError("Agent task failed.", 500, "AGENT_TASK_FAILED");
  }
}
