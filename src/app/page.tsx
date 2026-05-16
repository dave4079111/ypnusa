import Link from "next/link";
import { LoanPilotFloatingIntake } from "@/components/loanpilot-floating-assistant";

export default function Landing() {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div className="loanpilot-aurora pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
        <section className="max-w-xl space-y-8 text-white">
          <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100">
            LoanPilot AI · Borrower LOS fabric
          </span>

          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] lg:text-[3.2rem]">
              Always-on borrower intake wired straight into your LOS playbook.
            </h1>
            <p className="text-base text-white/90">
              Adaptive FHA, VA, DSCR, HELOC, refinance, and jumbo flows capture borrower facts, run LOS-grade
              qualification heuristics, mirror CRM objects, assign loan officers, launch nurture automations, and
              reserve calendar rails—without another static lead form.
            </p>
          </div>

          <ul className="grid gap-3 text-sm font-medium text-white/95">
            {[
              "Composite scoring overlays (FHA / VA eligibility / investor / refi deltas)",
              "CRM notes + LOS officer pings on every synced session",
              "Immediate SMS + confirmation email plus staged nurture ladders",
              "Placeholder calendar sync respecting officer routing windows",
            ].map((item) => (
              <li key={item} className="rounded-3xl bg-white/5 px-5 py-3 ring-1 ring-white/25 backdrop-blur">
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link
              href="/analytics"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-teal-800 shadow-xl shadow-teal-500/35"
            >
              View LOS analytics ledger
            </Link>
            <Link
              href="/embed/intake"
              className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-3 text-white shadow-inner backdrop-blur"
            >
              Open YPN embed surface
            </Link>
          </div>

          <p className="text-xs uppercase tracking-[0.32em] text-white/70">
            Tip: tap “AI intake concierge” floating action (bottom-right) to run the conversational rail.
          </p>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-[32px] border border-white/25 bg-white/10 p-[1px] shadow-2xl shadow-slate-900/40 backdrop-blur">
            <div className="rounded-[31px] bg-white px-8 py-8 text-slate-900 shadow-inner shadow-white">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">How the rail closes the loop</p>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">Borrower handshake → LOS sync</h2>

              <ol className="mt-8 space-y-4 text-sm text-slate-700">
                <li className="rounded-3xl bg-slate-50 px-4 py-4 font-medium">
                  1 · Conversational capture tailors underwriting prompts per routed program silhouette.
                </li>
                <li className="rounded-3xl bg-slate-50 px-4 py-4 font-medium">
                  2 · LoanPilot composites HUD/VA investor signals, urgency, LOS coaching text, and LOS officer assignment.
                </li>
                <li className="rounded-3xl bg-slate-50 px-4 py-4 font-medium">
                  3 · Salesforce-style mirrored notes funnel into JSON CRM today—swap adapters for Salesforce/Velocify.
                </li>
                <li className="rounded-3xl bg-slate-50 px-4 py-4 font-medium">
                  4 · Automated nurture + calendar booking stubs fire until your Twilio/Aircall transports arrive.
                </li>
              </ol>
            </div>
          </div>
        </section>
      </div>

      <LoanPilotFloatingIntake funnelSource="experience_hero_wave" />
    </div>
  );
}
