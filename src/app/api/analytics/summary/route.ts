import { NextResponse } from "next/server";
import { summarizeAnalyticsPulse } from "@/lib/analytics-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, analytics: summarizeAnalyticsPulse() });
}
