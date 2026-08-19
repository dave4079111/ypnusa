import { NextResponse } from "next/server";
import { runAgent, runPredictLeadForZip, type AgentTask, type AgentTaskType } from "@/lib/agents/coreAgent";
import type { Lead } from "@/lib/agents/predictiveAgent";
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
