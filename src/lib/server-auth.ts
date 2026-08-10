import { AUTH_COOKIE_NAME, verifySession } from "./auth";
import { marketingUrl } from "./site";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireMloSession() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    redirect(marketingUrl("/?app_login=required"));
  }
  return session;
}

export async function requireAdminSession() {
  const session = await requireMloSession();
  if (!session.profile.isAdmin) {
    redirect("/dashboard");
  }
  return session;
}
