import Link from "next/link";
import { buildNurtureDashboard } from "@/lib/nurture-dashboard";

export const dynamic = "force-dynamic";

function dateTime(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function stateTone(state: string): string {
  if (state === "Appointment booked") return "bg-emerald-100 text-emerald-800";
  if (state === "Outreach failed") return "bg-rose-100 text-rose-800";
  if (state === "Nurture active") return "bg-violet-100 text-violet-800";
  return "bg-amber-100 text-amber-800";
}

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

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
          <div className="border-b border-white/10 px-5 py-5 md:px-6">
            <h2 className="text-lg font-semibold">Borrower pipeline</h2>
            <p className="mt-1 text-sm text-white/50">
              Names are abbreviated in this shared operational view.
            </p>
          </div>

          {dashboard.rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold">No borrower conversations yet</p>
              <p className="mt-2 text-sm text-white/50">
                Complete the AI intake or post a lead webhook to populate this panel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-black/15 text-xs uppercase tracking-[0.12em] text-white/40">
                  <tr>
                    <th className="px-5 py-3 font-medium">Borrower</th>
                    <th className="px-5 py-3 font-medium">Qualification</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                    <th className="px-5 py-3 font-medium">Conversation</th>
                    <th className="px-5 py-3 font-medium">Next action</th>
                    <th className="px-5 py-3 font-medium">Assigned MLO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dashboard.rows.map((row) => (
                    <tr key={row.leadId} className="transition hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{row.borrowerName}</p>
                        <p className="mt-1 text-xs text-white/45">{row.loanProgram}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="capitalize">{row.quality}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {row.creditTier} · {row.timeline}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-semibold">
                          {row.score}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stateTone(row.state)}`}
                        >
                          {row.state}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white/75">
                        {row.appointmentStart ? (
                          <div>
                            <p>{dateTime(row.appointmentStart)}</p>
                            {row.meetingUrl ? (
                              <a
                                href={row.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs font-semibold text-violet-300 hover:text-violet-200"
                              >
                                Open meeting
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <div>
                            <p>{dateTime(row.nextFollowUp)}</p>
                            <p className="mt-1 text-xs uppercase text-white/40">
                              {row.nextChannel ?? "Offer appointment"}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-white/70">{row.officerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
