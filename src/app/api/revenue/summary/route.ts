import { requireSessionOrSecret } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { summarizeRevenuePulse } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireSessionOrSecret(request);
  if (unauthorized) return unauthorized;

  return jsonOk({ data: summarizeRevenuePulse() });
}
