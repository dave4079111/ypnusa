import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth";
import { marketingUrl } from "@/lib/site";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    redirect(marketingUrl("/?app_login=required"));
  }
  redirect("/portal/nurture");
}
