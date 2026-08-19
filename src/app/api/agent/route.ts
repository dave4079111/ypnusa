import { NextResponse } from "next/server";
import { runAgent, type AgentTask, type AgentTaskType } from "@/lib/agents/coreAgent";
import { isRecord, jsonError, logApiError, parseJsonBody, requireSecret } from "@/lib/http";

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
]);

export async function POST(request: Request) {
  const unauthorized = requireSecret(request);
  if (unauthorized) return unauthorized;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);

  const body = parsed.data;
  if (
    !isRecord(body) ||
    typeof body.type !== "string" ||
    !VALID_TASK_TYPES.has(body.type as AgentTaskType)
  ) {
    return jsonError("Body must include a known task type.", 400, "INVALID_TASK_TYPE");
  }

  try {
    const result = await runAgent(body as unknown as AgentTask);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    logApiError("/api/agent", error);
    return jsonError("Agent task failed.", 500, "AGENT_TASK_FAILED");
  }
}
