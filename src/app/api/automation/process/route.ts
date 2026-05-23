import { NextResponse } from "next/server";
import { processDueFollowUps } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const summary = processDueFollowUps();
  return NextResponse.json({ ok: true, ...summary });
}
