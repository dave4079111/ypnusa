import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  appSessionCookieName,
  verifyAppSessionToken,
  type AppSessionClaims,
} from "./auth";
import { marketingUrl } from "./site";

export async function getAppSession(): Promise<AppSessionClaims | null> {
  const token = (await cookies()).get(appSessionCookieName())?.value;
  if (!token) return null;
  try {
    return verifyAppSessionToken(token);
  } catch {
    return null;
  }
}

export async function requireAppSession(): Promise<AppSessionClaims> {
  const session = await getAppSession();
  if (!session) {
    redirect(marketingUrl("/wp-admin/admin-post.php?action=ypnus_app_sso"));
  }
  return session;
}
