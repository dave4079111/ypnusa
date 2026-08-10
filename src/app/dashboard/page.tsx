import { requireMloSession } from "@/lib/server-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireMloSession();
  redirect("/portal/nurture");
}
