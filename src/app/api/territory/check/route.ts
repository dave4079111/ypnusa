import { NextResponse } from "next/server";
import { fetchLiveTerritory } from "@/lib/live-territory";
import { checkTerritory } from "@/lib/territory";
import { jsonError, logApiError } from "@/lib/http";
import { clientKey, distributedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = await distributedRateLimit(
      `territory-check:${clientKey(request)}`,
      60,
      60_000,
    );
    if (!limited.ok) {
      return jsonError("Too many territory checks.", 429, "RATE_LIMITED", {
        headers: { "Retry-After": String(limited.retryAfter) },
      });
    }
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

    if (process.env.NODE_ENV === "production") {
      return jsonError(
        "Live territory availability is temporarily unavailable.",
        503,
        "LIVE_TERRITORY_UNAVAILABLE",
        { headers: { "Retry-After": "30" } },
      );
    }
    const local = checkTerritory(zip);
    return NextResponse.json({ ...local, source: "local_demo" });
  } catch (error) {
    logApiError("/api/territory/check", error);
    return jsonError("Territory availability is temporarily unavailable.", 500, "TERRITORY_CHECK_FAILED");
  }
}
