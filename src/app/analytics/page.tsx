import Link from "next/link";
import { summarizeAnalyticsPulse } from "@/lib/analytics-core";

export const dynamic = "force-dynamic";

export default function LoanPilotAnalytics() {
  const pulse = summarizeAnalyticsPulse();

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-10 bg-slate-50 px-6 py-16 text-slate-900">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-600">Operational visibility</p>
        <h1 className="text-3xl font-semibold">YPN USA intake telemetry</h1>
        <p className="text-sm text-slate-600">
          Completion rates infer event ledger ratios; qualification mix summarizes persisted LOS artifacts.
          Follow-up pulses appear once the automation cron route processes outstanding queue rows.
        </p>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-teal-600">
          ← Back to homepage
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-3xl bg-white p-5 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sessions launched</p>
          <p className="mt-4 text-3xl font-semibold">{pulse.totals.sessionsStarted}</p>
        </article>

        <article className="rounded-3xl bg-white p-5 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">LOS completions</p>
          <p className="mt-4 text-3xl font-semibold">{pulse.totals.completions}</p>
        </article>

        <article className="rounded-3xl bg-white p-5 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Booking wins</p>
          <p className="mt-4 text-3xl font-semibold">{pulse.bookingsCaptured}</p>
        </article>

        <article className="rounded-3xl bg-white p-5 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg lead score</p>
          <p className="mt-4 text-3xl font-semibold">{pulse.averageLosCompositeScore}</p>
        </article>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-3xl bg-white p-6 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">Intake completion rate</h2>
            <p className="text-sm text-slate-600">
              Borrowers who finish versus those who started the AI intake assistant.
            </p>
          </header>
          <p className="mt-6 text-5xl font-bold text-cyan-600">{pulse.completionRatePct}%</p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">Qualification posture</h2>
            <p className="text-sm text-slate-600">
              Shares across persisted LOS leads—not future predictions.
            </p>
          </header>
          <ul className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
            <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-2">
              <span>Prime</span>
              <span>{pulse.qualificationMixPct.prime}%</span>
            </li>
            <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-2">
              <span>Strong</span>
              <span>{pulse.qualificationMixPct.strong}%</span>
            </li>
            <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-2">
              <span>Developing</span>
              <span>{pulse.qualificationMixPct.developing}%</span>
            </li>
            <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-2">
              <span>Watchlist</span>
              <span>{pulse.qualificationMixPct.watch}%</span>
            </li>
          </ul>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100 md:col-span-2">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">Program demand pulses</h2>
            <p className="text-sm text-slate-600">
              Weighted tally of LOS analytics events keyed by routed program archetype.
            </p>
          </header>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Object.entries(pulse.funnel).map(([program, count]) => (
              <div key={program} className="flex justify-between rounded-2xl border border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
                <span>{program}</span>
                <span>{count}</span>
              </div>
            ))}
            {Object.keys(pulse.funnel).length === 0 ? (
              <p className="text-sm text-slate-500">No traffic yet — launch the assistant.</p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
