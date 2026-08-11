import { NextResponse } from "next/server";
import { requireSessionOrSecret } from "@/lib/auth";
import { summarizeRevenuePulse } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireSessionOrSecret(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ ok: true, data: summarizeRevenuePulse() });
}
