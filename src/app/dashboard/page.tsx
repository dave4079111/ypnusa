import type { Metadata } from "next";
import Link from "next/link";
import { requireAppSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "MLO Dashboard",
  description: "Secure YPN USA account and operations dashboard.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await requireAppSession();
  const tools = [
    {
      href: "/portal/nurture",
      title: "Borrower pipeline",
      body: "Review qualified leads, nurture status, appointments, and equity-review requests.",
    },
    {
      href: "/analytics",
      title: "Conversion analytics",
      body: "Track intake completion, qualification mix, bookings, and program demand.",
    },
    {
      href: "/dashboard/local-seo",
      title: "Local SEO & GBP",
      body: "Check public business details, territory pages, review readiness, and map configuration.",
    },
    {
      href: "/tools/equity",
      title: "Borrower equity tool",
      body: "Open the public equity snapshot that routes consented review requests into your portal.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#09081b] px-5 py-10 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
              Secure MLO workspace
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Welcome, {session.name}.
            </h1>
            <p className="mt-3 text-sm text-white/55">{session.email}</p>
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Plan</p>
            <p className="mt-3 text-2xl font-semibold capitalize">{session.tier}</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Subscription</p>
            <p className="mt-3 text-2xl font-semibold capitalize">
              {session.subscriptionStatus.replaceAll("_", " ")}
            </p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Access</p>
            <p className={`mt-3 text-2xl font-semibold ${session.paidAccess ? "text-emerald-300" : "text-amber-200"}`}>
              {session.paidAccess ? "Enabled" : "Restricted"}
            </p>
          </article>
        </section>

        {!session.paidAccess ? (
          <section className="mt-6 rounded-3xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm leading-6 text-amber-50">
            Paid features are restricted because this subscription is not active. Your account and
            data remain available; update billing on YPN USA to restore access.
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-3xl border border-white/10 bg-white/[0.06] p-6 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-white/[0.09]"
            >
              <h2 className="text-xl font-semibold group-hover:text-violet-200">{tool.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">{tool.body}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-violet-300">
                Open tool →
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
