import type { Metadata } from "next";
import Link from "next/link";
import { LoanPilotFloatingIntake } from "@/components/loanpilot-floating-assistant";

export const metadata: Metadata = {
  title: "AI-Powered Mortgage Borrower Intake & Lead Qualification",
  description:
    "Replace static lead forms with an always-on AI intake that qualifies FHA, VA, DSCR, HELOC, refi, and jumbo borrowers in real time — then syncs your CRM, assigns loan officers, and launches nurture automatically.",
  alternates: {
    canonical: "https://ypnusa.com",
  },
  openGraph: {
    title: "LoanPilot AI — Mortgage Intake Automation That Closes More Loans",
    description:
      "Qualify borrowers in minutes. Sync CRM, assign LOs, trigger nurture — all from one AI-powered intake rail covering FHA, VA, DSCR, HELOC, refi & jumbo.",
    url: "https://ypnusa.com",
  },
};

const FEATURES = [
  {
    icon: "🎯",
    title: "Instant lead qualification",
    body: "LOS-grade composite scoring across FHA, VA, DSCR, HELOC, refi, and jumbo — every borrower ranked Prime, Strong, Developing, or Watchlist before your team picks up the phone.",
  },
  {
    icon: "🔗",
    title: "Automatic CRM & LO sync",
    body: "Borrower answers, qualification scores, and AI coaching notes mirror into your CRM the moment intake completes. The right loan officer is assigned automatically based on specialty and workload.",
  },
  {
    icon: "📲",
    title: "Nurture automations fire instantly",
    body: "Confirmation email, SMS acknowledgment, and a 5-touch drip sequence launch the second the borrower finishes — no manual follow-up required.",
  },
  {
    icon: "📅",
    title: "Calendar booking built in",
    body: "Borrowers pick a consultation slot that respects each loan officer's availability windows. No back-and-forth scheduling, no dropped leads.",
  },
];

const PROGRAMS = ["FHA", "VA", "DSCR", "HELOC", "Refinance", "Jumbo"];

const STATS = [
  { value: "6", label: "Loan programs supported" },
  { value: "< 3 min", label: "Average intake completion" },
  { value: "5-touch", label: "Automated nurture sequence" },
  { value: "100%", label: "Leads scored & routed" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Borrower starts the AI intake",
    body: "Conversational questions adapt to the selected loan program — only the questions that matter, in the right order.",
  },
  {
    step: "02",
    title: "Real-time qualification scoring",
    body: "LoanPilot composites credit signals, HUD/VA eligibility, urgency, and program fit into a 0–100 LOS composite score.",
  },
  {
    step: "03",
    title: "CRM sync & LO assignment",
    body: "Borrower profile, score, and coaching notes post to your CRM. The load-balanced loan officer assignment fires immediately.",
  },
  {
    step: "04",
    title: "Nurture + booking on autopilot",
    body: "SMS + email confirmation go out within seconds. The borrower books a consultation. Your team follows up with full context.",
  },
];

export default function Landing() {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div className="loanpilot-aurora pointer-events-none absolute inset-0" aria-hidden />

      {/* ── HERO ── */}
      <section
        aria-label="Hero"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-14"
      >
        <div className="max-w-xl space-y-8 text-white">
          <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100">
            LoanPilot AI · Mortgage intake automation
          </span>

          <div className="space-y-5">
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] lg:text-[3.2rem]">
              Qualify mortgage borrowers instantly. Close more loans on autopilot.
            </h1>
            <p className="text-lg text-white/90">
              Replace static lead forms with an AI-powered intake that qualifies FHA, VA, DSCR, HELOC,
              refinance, and jumbo borrowers in real time — then syncs your CRM, assigns the right loan
              officer, and launches nurture automations automatically.
            </p>
          </div>

          {/* Program badges */}
          <div className="flex flex-wrap gap-2">
            {PROGRAMS.map((p) => (
              <span
                key={p}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
              >
                {p}
              </span>
            ))}
          </div>

          {/* Stats bar */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <dt className="text-[11px] text-white/60">{label}</dt>
                <dd className="mt-1 text-xl font-bold text-white">{value}</dd>
              </div>
            ))}
          </dl>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <button
              type="button"
              aria-label="Try the AI intake demo"
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-white px-7 py-3.5 text-teal-800 shadow-xl shadow-teal-500/35 transition hover:shadow-teal-400/50"
              onClick={undefined}
              id="hero-cta-try-demo"
            >
              Try the AI intake — free demo ↓
            </button>
            <Link
              href="/analytics"
              className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-3.5 text-white shadow-inner backdrop-blur transition hover:bg-white/20"
            >
              View live analytics →
            </Link>
          </div>

          <p className="text-xs text-white/60">
            No credit card required. &nbsp;·&nbsp; Works with Salesforce, Velocify & more.
          </p>
        </div>

        {/* How-it-works card */}
        <aside aria-label="How LoanPilot AI works" className="w-full max-w-md">
          <div className="rounded-[32px] border border-white/25 bg-white/10 p-[1px] shadow-2xl shadow-slate-900/40 backdrop-blur">
            <div className="rounded-[31px] bg-white px-8 py-8 text-slate-900 shadow-inner shadow-white">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                How it works — 4 steps
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Intake starts. Loan closes.
              </h2>

              <ol className="mt-6 space-y-3 text-sm text-slate-700">
                {HOW_IT_WORKS.map(({ step, title, body }) => (
                  <li key={step} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <span className="text-[10px] font-bold tracking-widest text-teal-600">
                      STEP {step}
                    </span>
                    <p className="mt-1 font-semibold text-slate-900">{title}</p>
                    <p className="mt-0.5 text-slate-600">{body}</p>
                  </li>
                ))}
              </ol>

              <p className="mt-5 text-center text-xs text-slate-400">
                Tap the <strong className="text-teal-700">"Try the AI intake"</strong> button above to run the live demo →
              </p>
            </div>
          </div>
        </aside>
      </section>

      {/* ── FEATURES ── */}
      <section
        aria-label="Features"
        className="relative z-10 w-full border-t border-white/10 bg-white/5 px-6 py-16 backdrop-blur"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-white">
            Everything your team needs — automated
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white/75">
            LoanPilot AI handles the full borrower journey from first question to calendar booking,
            so your loan officers spend time on closings, not data entry.
          </p>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon, title, body }) => (
              <li
                key={title}
                className="rounded-3xl border border-white/20 bg-white/10 px-6 py-6 backdrop-blur"
              >
                <span className="text-3xl" role="img" aria-hidden>
                  {icon}
                </span>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/75">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section
        aria-label="Call to action"
        className="relative z-10 px-6 py-16 text-center"
      >
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl font-semibold text-white">
            Ready to stop losing leads to slow follow-up?
          </h2>
          <p className="text-white/80">
            Start the AI intake concierge below and experience exactly what your borrowers will see.
            Swap in your branding, connect your CRM, and go live in days.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold">
            <Link
              href="/embed/intake"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-teal-800 shadow-xl shadow-teal-500/35 transition hover:shadow-teal-400/50"
            >
              See the borrower embed →
            </Link>
            <Link
              href="/analytics"
              className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-3.5 text-white backdrop-blur transition hover:bg-white/20"
            >
              View the analytics dashboard →
            </Link>
          </div>
        </div>
      </section>

      <LoanPilotFloatingIntake funnelSource="experience_hero_wave" />
    </div>
  );
}
