import { NextResponse } from "next/server";
import { listAvailableSlots } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const loId = searchParams.get("loId") ?? undefined;
  const horizon = Number(searchParams.get("horizon") ?? "12");

  const slots = listAvailableSlots(loId, Number.isFinite(horizon) ? horizon : 12);
  return NextResponse.json({ ok: true, slots });
}
