export const siteName = "LoanPilot AI";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loanpilot.ai").replace(/\/$/, "");

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteUrl}/`).toString();
}
