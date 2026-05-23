import { NextResponse } from "next/server";
import type { IntakeTickRequest } from "@/lib/intake-contracts";
import { intakeTick } from "@/lib/intake-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IntakeTickRequest;
    const envelope = intakeTick(body);
    return NextResponse.json(envelope);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Malformed JSON payload.",
        sessionId: "",
        phase: "collecting",
        progress: { pct: 0, completed: 0, totalApplicable: 0 },
        assistantMessage: "Request body must be JSON.",
        answers: { loanProgram: "FHA" },
        loanProgram: "FHA" as const,
      },
      { status: 400 },
    );
  }
}
