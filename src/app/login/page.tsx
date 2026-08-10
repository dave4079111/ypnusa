import type { Metadata } from "next";
import { DevLoginForm } from "@/components/dev-login-form";
import { marketingUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const ALLOWED_NEXT_PREFIXES = ["/dashboard", "/portal", "/analytics", "/admin"];

function resolveNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    if (ALLOWED_NEXT_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) {
      return value;
    }
  }
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = resolveNext(params.next);
  const signupHref = marketingUrl(`/lo-signup.html?plan=free&app_next=${encodeURIComponent(next)}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">Sign in</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Access your YPN USA dashboard</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Account creation and identity verification happen on ypnus.com. Once you sign in or sign up
        there, you&apos;re redirected back here into an authenticated app.ypnus.com session — this app
        never asks for your ypnus.com password directly.
      </p>
      <a
        href={signupHref}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
      >
        Continue to ypnus.com
      </a>

      {process.env.NODE_ENV !== "production" && <DevLoginForm next={next} />}
    </main>
  );
}
