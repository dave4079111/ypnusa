import Link from "next/link";
import type { Metadata } from "next";
import { SessionBar } from "@/components/session-bar";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  {
    href: "/portal/nurture",
    title: "Lead Nurture & Appointments",
    description: "AI-qualified borrowers, outreach health, and calendar conversions.",
  },
  {
    href: "/analytics",
    title: "Intake Telemetry",
    description: "Completion rates, qualification mix, and follow-up pulses.",
  },
  {
    href: "/dashboard/local-seo",
    title: "Local SEO & GBP",
    description: "Territory pages and verified Google review connections.",
  },
  {
    href: "/admin/revenue",
    title: "Revenue Breakdown",
    description: "Subscription tiers and territory claims.",
  },
] as const;

export default function DashboardHubPage() {
  return (
    <main className="min-h-full bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">
              YPN USA
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <SessionBar />
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-violet-300 hover:shadow-lg"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
