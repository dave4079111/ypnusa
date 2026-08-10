import { getSession } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return jsonOk({
    session: session ? { email: session.email, role: session.role } : null,
  });
}
