import { productionReadiness } from "@/lib/config";
import { storageMode } from "@/lib/db";
import { jsonError, jsonOk, logApiError, requireAdminOrBearer } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const storage = storageMode();
    const readiness = productionReadiness();
    const ready =
      process.env.NODE_ENV !== "production" || (readiness.ready && storage.persistent);
    const wantsDetail = new URL(request.url).searchParams.get("detail") === "1";
    const detailAuthorized = wantsDetail ? requireAdminOrBearer(request) === null : false;

    return jsonOk(
      {
        service: "ypnusa-app",
        ready,
        integrations: readiness.integrations,
        issueCount: readiness.missing.length + (storage.persistent ? 0 : 1),
        ...(detailAuthorized
          ? {
              missing: readiness.missing,
              storage,
            }
          : {}),
        timestamp: new Date().toISOString(),
      },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logApiError("/api/health", error);
    return jsonError("Health check failed.", 500, "HEALTH_CHECK_FAILED");
  }
}
