import { storageMode } from "@/lib/db";
import { jsonError, jsonOk, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = storageMode();

    return jsonOk({
      service: "ypnusa-app",
      storage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logApiError("/api/health", error);
    return jsonError("Health check failed.", 500, "HEALTH_CHECK_FAILED");
  }
}
