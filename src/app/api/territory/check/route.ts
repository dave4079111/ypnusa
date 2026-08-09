import { NextResponse } from "next/server";
import { fetchLiveTerritory } from "@/lib/live-territory";
import { checkTerritory } from "@/lib/territory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip") ?? "";

  // Prefer the live ypnus.com lock ledger so app.ypnus.com matches production.
  const live = await fetchLiveTerritory(zip);
  if (live) {
    return NextResponse.json({
      ok: live.ok,
      zip: live.zip,
      valid: live.valid,
      available: live.available,
      totalClaimed: live.totalClaimed,
      message: live.message,
      source: live.live ? "ypnus_wp" : "local_validation",
      city: live.live?.city ?? null,
      state: live.live?.state ?? null,
      signupUrl: live.live?.signup_url ?? null,
      demand: live.live?.demand ?? null,
    });
  }

  const local = checkTerritory(zip);
  return NextResponse.json({ ...local, source: "local_demo" });
}
