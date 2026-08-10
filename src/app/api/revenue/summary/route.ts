import { NextResponse } from "next/server";
import { requireConfiguredSecret } from "@/lib/http";
import { summarizeRevenuePulse } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireConfiguredSecret(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ ok: true, data: summarizeRevenuePulse() });
}
