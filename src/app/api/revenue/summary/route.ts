import { NextResponse } from "next/server";
import { summarizeRevenuePulse } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, data: summarizeRevenuePulse() });
}
