import Link from "next/link";
import { NurturePipeline } from "@/components/portal/nurture-pipeline";
import { buildNurtureDashboard } from "@/lib/nurture-dashboard";

export const dynamic = "force-dynamic";

export default function LeadNurturePortalPage() {
  const dashboard = buildNurtureDashboard();
  const metricCards = [
    ["Active AI conversations", dashboard.totals.activeConversations],
    ["Upcoming appointments", dashboard.totals.upcomingAppointments],
    ["Scheduled nurture touches", dashboard.totals.pendingTouches],
    ["Average lead score", dashboard.totals.averageScore],
  ] as const;

  return (
    <main className="min-h-screen bg-[#09081b] px-5 py-10 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
              MLO operations
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Lead Nurture &amp; Appointments
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              Monitor AI-qualified borrowers, outreach health, long-term nurture, and calendar
              conversions from one live ledger.
            </p>
          </div>
          <Link
            href="/"
            className="w-fit rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            Back to YPN USA
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(([label, value]) => (
            <article
              key={label}
              className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">{label}</p>
              <p className="mt-4 text-4xl font-semibold">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Calendar connections</h2>
              <p className="text-sm text-white/50">
                Google Calendar and Microsoft create live video meetings; Calendly hands off to
                its hosted booking page.
              </p>
            </div>
            <span className="w-fit rounded-full bg-violet-400/15 px-3 py-1 text-xs font-semibold text-violet-200">
              Real-time sync
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {dashboard.calendarConnections.map((connection) => (
              <article
                key={connection.officerId}
                className="rounded-2xl border border-white/10 bg-black/15 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{connection.officerName}</p>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      connection.connected ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                    aria-label={connection.connected ? "Connected" : "Needs configuration"}
                  />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.15em] text-white/40">
                  {connection.provider} · {connection.timeZone}
                </p>
              </article>
            ))}
          </div>
        </section>

        <NurturePipeline rows={dashboard.rows} />
      </div>
    </main>
  );
}
