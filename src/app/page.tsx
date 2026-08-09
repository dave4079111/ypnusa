import Link from "next/link";
import { MortgageIntakeChat } from "@/components/lazy-loanpilot-assistant";
import { TerritoryClaim } from "@/components/territory-claim";
import { MortgageCalculator } from "@/components/mortgage-calculator";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { marketingUrl } from "@/lib/site";

const LIFE_EVENTS = [
  {
    tag: "Probate",
    title: "Probate & estate financing",
    body: "Surface newly filed probate cases in your territory the day they hit the court record — long before the property reaches the MLS.",
  },
  {
    tag: "Divorce",
    title: "Divorce & refinance signals",
    body: "Catch dissolution filings that often trigger a refinance or a sell-and-rebuy, so you're the first lender in the conversation.",
  },
  {
    tag: "Marriage",
    title: "New-union homebuyers",
    body: "Newly married couples are prime first-time-buyer candidates. Reach them with life-stage messaging that builds trust, not friction.",
  },
];

const CAPABILITIES = [
  {
    icon: "💬",
    title: "Captures every borrower",
    body: "A conversational AI greets visitors 24/7, adapts its questions to FHA, VA, conventional, DSCR, HELOC, refi, or jumbo, and never lets a lead bounce without capturing their details.",
  },
  {
    icon: "🎯",
    title: "Qualifies while you sleep",
    body: "It scores credit posture, income, intent, and urgency in real time — so tire-kickers get nurtured and prime borrowers get flagged the moment they're hot.",
  },
  {
    icon: "⚡",
    title: "Follows up instantly",
    body: "Confirmation email, SMS acknowledgment, and a multi-day nurture ladder fire automatically. No borrower waits hours for a callback again.",
  },
  {
    icon: "📅",
    title: "Books the consultation",
    body: "Qualified borrowers land straight on your calendar with the right context attached. You show up to a warm, pre-qualified conversation.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Claim your ZIP territory",
    body: "Lock exclusive rights to the borrower demand in your ZIP codes. One MLO per territory — no bidding wars, no shared leads, no waiting on Realtors.",
  },
  {
    n: "2",
    title: "Your AI agent goes to work",
    body: "We deploy your always-on intake assistant on your own MLO website. It captures, qualifies, routes, and nurtures every borrower automatically.",
  },
  {
    n: "3",
    title: "You close more loans",
    body: "Pre-qualified, pre-scheduled borrowers hit your calendar. You spend time closing — not chasing cold forms and recycled leads.",
  },
];

const OWNERSHIP = [
  {
    icon: "🔑",
    title: "Your leads are yours — forever",
    body: "Every borrower your AI captures belongs to you, exported and portable. Change brokerages tomorrow and your entire book comes with you.",
  },
  {
    icon: "🌐",
    title: "Your MLO website travels with you",
    body: "The intake site and assistant are tied to you, not your employer. Switch companies and keep your domain, your funnel, and your pipeline intact.",
  },
  {
    icon: "🛡️",
    title: "No more starting over",
    body: "Most MLOs lose their pipeline every time they move. With YPN USA, your growth engine follows you for your entire career.",
  },
];

const PROGRAMS = ["FHA", "VA", "Conventional", "DSCR", "HELOC", "Refinance", "Jumbo"];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever · no card",
    tagline: "Prove demand on your first ZIP",
    features: [
      "1 exclusive ZIP to start",
      "AI borrower intake assistant",
      "Qualification + scoring",
      "You own every lead you capture",
      "Upgrade when pull-through is real",
    ],
    cta: "Start free",
    plan: "free",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$29.99",
    cadence: "/mo",
    tagline: "Lock a small exclusive footprint",
    features: [
      "Up to 3 exclusive ZIPs",
      "Branded borrower experience",
      "AI intake + follow-up",
      "Territory demand reports",
      "Cancel anytime",
    ],
    cta: "Claim Starter",
    plan: "starter",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$99.99",
    cadence: "/mo",
    tagline: "For the serious loan officer",
    features: [
      "Up to 5 exclusive ZIPs",
      "Portable MLO website",
      "SMS + email nurture ladders",
      "Calendar booking + CRM mirroring",
      "Keep leads & site if you switch",
    ],
    cta: "Claim Pro",
    plan: "pro",
    highlight: true,
  },
  {
    name: "Elite",
    price: "$299.99",
    cadence: "/mo",
    tagline: "Unlimited exclusive capacity",
    features: [
      "Unlimited exclusive ZIPs",
      "Priority territory expansion",
      "Advanced life-event signals",
      "White-glove onboarding",
      "Team / brokerage ready",
    ],
    cta: "Go Elite",
    plan: "elite",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "What does “exclusive ZIP territory” actually mean?",
    a: "You lock the rights to borrower demand in specific ZIP codes. Only one loan officer owns a territory at a time — so you're never competing with five other MLOs for the same recycled lead.",
  },
  {
    q: "Do I really keep my leads if I switch brokerages?",
    a: "Yes. Your leads, your pipeline, your MLO website, and your domain are tied to you — not your employer. If you change companies, your entire book of business and growth engine come with you.",
  },
  {
    q: "Is this really autonomous, or do I have to run it?",
    a: "It runs itself. The AI captures borrowers, qualifies them, sends follow-ups, and books consultations automatically. You get warm, pre-qualified conversations on your calendar without lifting a finger.",
  },
  {
    q: "Which loan programs does it handle?",
    a: "FHA, VA, conventional, DSCR, HELOC, refinance, and jumbo — each with a tailored question flow. DSCR and investor lending are fully supported, so you can capture the fast-growing investor-borrower market too.",
  },
  {
    q: "How much does it cost to start?",
    a: "Nothing. Start free on one ZIP with no credit card. Paid plans are Starter $29.99/mo, Pro $99.99/mo, and Elite $299.99/mo when you're ready to lock more exclusive capacity.",
  },
];

function signupHrefForPlan(plan: string) {
  return marketingUrl(`/lo-signup.html?plan=${encodeURIComponent(plan)}`);
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-[#09081b] pb-24 text-white md:pb-0">
      <SiteHeader />

      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:py-24">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              Exclusive ZIP demand · for MLOs
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] lg:text-[3.4rem]">
              Own your mortgage leads — <span className="text-violet-300">without waiting on Realtors.</span>
            </h1>
            <p className="mt-5 text-lg text-white/90">
              YPN USA gives you an exclusive ZIP-code territory and an always-on AI agent that captures,
              qualifies, and nurtures every borrower in it — automatically. And the leads and website are
              yours to keep, even if you switch brokerages.
            </p>

            <div className="mt-7 flex flex-wrap gap-4 text-sm font-semibold">
              <a
                href="#territories"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Claim your ZIP — free
              </a>
              <a
                href="#demo"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3.5 text-white backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                See the AI live ↓
              </a>
            </div>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/70">
              {["Free to start", "No credit card", "You keep every lead"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-emerald-400">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                ["24/7", "Always-on capture"],
                ["1 MLO", "Per territory"],
                ["100%", "Leads you own"],
              ].map(([stat, label]) => (
                <div key={label} className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/15">
                  <dt className="text-2xl font-bold text-violet-200">{stat}</dt>
                  <dd className="text-[11px] uppercase tracking-wide text-white/70">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="w-full lg:max-w-md">
            <TerritoryClaim source="hero" />
          </div>
        </div>
      </section>

      {/* TRUST / VALUE STRIP */}
      <section className="border-b border-white/10 bg-[#0b0a20]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px overflow-hidden px-4 py-6 text-center sm:px-6 md:grid-cols-4">
          {[
            ["🔒", "Exclusive to you", "One MLO per ZIP"],
            ["🔑", "Own your leads", "Portable for life"],
            ["🤖", "AI does the work", "Capture to booking"],
            ["⚡", "Live in days", "No developer needed"],
          ].map(([icon, title, sub]) => (
            <div key={title} className="px-3 py-2">
              <div className="text-xl" aria-hidden>{icon}</div>
              <p className="mt-1 text-sm font-semibold text-white">{title}</p>
              <p className="text-[12px] text-white/60">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-y border-white/10 bg-[#0d0b26] py-14">
        <div className="mx-auto w-full max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-semibold text-white lg:text-3xl">Shared leads are a tax on your career.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/75">
            You buy a lead. So do four other officers. You race to dial first, most never answer, and the
            ones who do already talked to your competition. Then you switch companies and lose the whole
            pipeline. YPN USA ends that — exclusive territory, autonomous follow-up, and a book you own for life.
          </p>
        </div>
      </section>

      {/* AGENTIC CAPABILITIES */}
      <section id="how" className="bg-white py-20 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Everything an MLO needs</p>
            <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">An AI agent that does the whole job</h2>
            <p className="mt-4 text-slate-600">
              YPN USA isn&apos;t another lead form. It&apos;s an autonomous teammate that works your territory around the clock.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((c) => (
              <article key={c.title} className="rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-xl">
                  <span aria-hidden>{c.icon}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.body}</p>
              </article>
            ))}
          </div>

          {/* Steps */}
          <div className="mx-auto mt-20 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Three steps</p>
            <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">From ZIP code to pipeline</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-3xl border border-slate-100 p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXCLUSIVE TERRITORIES */}
      <section id="territories" className="relative isolate overflow-hidden bg-[#09081b] py-20">
        <div className="ypn-aurora pointer-events-none absolute inset-0 opacity-80" aria-hidden />
        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              Exclusive ZIP territories
            </span>
            <h2 className="text-3xl font-semibold lg:text-4xl">Own your ZIP codes. Stop sharing leads.</h2>
            <p className="text-lg text-white/85">
              Every borrower who searches for financing in your territory routes to you — and only you.
              No lead resold to five competitors. No race to dial first. Just your market, protected.
            </p>
            <ul className="space-y-3 text-sm text-white/90">
              {[
                "One loan officer per ZIP — guaranteed exclusivity",
                "First-come reservations; popular metros go fast",
                "Expand into neighboring ZIPs as you grow",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/15">
                  <span aria-hidden className="text-amber-300">◆</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <TerritoryClaim source="territory_section" />
        </div>
      </section>

      {/* OWNERSHIP / PORTABILITY */}
      <section id="ownership" className="bg-white py-20 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">You own it — for life</p>
            <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">Switch brokerages? Keep everything.</h2>
            <p className="mt-4 text-slate-600">
              Your pipeline shouldn&apos;t reset every time you change companies. With YPN USA, your leads and
              your website belong to <span className="font-semibold text-slate-900">you</span> — permanently.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {OWNERSHIP.map((o) => (
              <article key={o.title} className="rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-7 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#09081b] text-xl">
                  <span aria-hidden>{o.icon}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{o.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* LIFE EVENT INTELLIGENCE */}
      <section id="intelligence" className="relative isolate overflow-hidden bg-[#0d0b26] py-20">
        <div className="ypn-aurora pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              Predictive life-event intelligence
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-white lg:text-4xl">
              Find motivated borrowers before the listing hits
            </h2>
            <p className="mt-4 text-white/80">
              Beyond inbound capture, YPN USA monitors public court and county records in your territory to
              surface borrowers at the exact life moment they need financing — a head start no shared-lead
              vendor can offer.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {LIFE_EVENTS.map((e) => (
              <article key={e.tag} className="rounded-3xl border border-white/12 bg-white/[0.05] p-7 backdrop-blur">
                <span className="inline-flex rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#09081b]">
                  {e.tag}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{e.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{e.body}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-white/45">
            Built on anonymized, publicly available records and paired with compliant, life-stage-aware outreach.
            Availability of specific data sources varies by county and plan.
          </p>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="bg-slate-100 py-20 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">See it work</p>
            <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">See your MLO website before you buy it</h2>
            <p className="mt-4 text-slate-600">
              Try it yourself — pick a loan program and answer a few questions. This is the exact autonomous
              intake that captures, scores, and routes every borrower in your territory.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-lg">
            <MortgageIntakeChat brand="ypn" variant="embed" funnelSource="homepage_live_demo" />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Programs supported:</span>
            {PROGRAMS.map((p) => (
              <span key={p} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CALCULATOR */}
      <section id="calculator" className="bg-white py-20 text-slate-900">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Engage on contact</p>
            <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">An interactive tool your borrowers can&apos;t ignore</h2>
            <p className="mt-4 text-slate-600">
              Every YPN USA site ships with a live payment calculator that keeps borrowers engaged — and hands
              you the intent signal the moment they start modeling a loan.
            </p>
          </div>
          <div className="mt-12">
            <MortgageCalculator />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-white py-20 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">Start free. Upgrade when you&apos;re ready.</h2>
            <p className="mt-4 text-slate-600">Reserve a ZIP, deploy your AI, and own the pipeline it builds.</p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {PRICING.map((tier) => (
              <article
                key={tier.name}
                className={`flex min-h-full flex-col rounded-3xl border p-6 transition duration-200 hover:-translate-y-1 md:p-8 ${
                  tier.highlight
                    ? "border-violet-400 bg-[#09081b] text-white shadow-2xl shadow-violet-500/20 ring-2 ring-violet-400/40"
                    : "border-slate-200 bg-white text-slate-900 shadow-sm"
                }`}
              >
                {tier.highlight ? (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#09081b]">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className={`mt-1 text-sm ${tier.highlight ? "text-white/70" : "text-slate-500"}`}>{tier.tagline}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className={`pb-1 text-sm ${tier.highlight ? "text-white/70" : "text-slate-500"}`}>{tier.cadence}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span aria-hidden className={tier.highlight ? "text-amber-300" : "text-violet-600"}>✓</span>
                      <span className={tier.highlight ? "text-white/90" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={signupHrefForPlan(tier.plan)}
                  className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 ${
                    tier.highlight
                      ? "bg-amber-400 text-[#09081b] shadow-lg shadow-amber-500/30"
                      : "bg-[#09081b] text-white"
                  }`}
                >
                  {tier.cta}
                </a>
                <a
                  href="#territories"
                  className={`mt-3 text-center text-xs font-semibold underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 ${
                    tier.highlight ? "text-white/75 focus-visible:ring-violet-300" : "text-violet-700 focus-visible:ring-violet-500"
                  }`}
                >
                  Check ZIP availability first
                </a>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {["Start free — no credit card", "Cancel anytime", "You keep every lead you capture"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span aria-hidden className="text-emerald-600">✓</span>
                {item}
              </span>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Territory availability is limited and first-come. Prices shown are launch rates.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto w-full max-w-3xl px-6">
          <h2 className="text-center text-3xl font-semibold lg:text-4xl">Everything you need to know</h2>
          <div className="mt-10 space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between text-base font-semibold text-slate-900 marker:content-none">
                  {item.q}
                  <span aria-hidden className="ml-4 text-violet-600 transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative isolate overflow-hidden bg-[#09081b] py-20">
        <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold lg:text-4xl">Stop giving your pipeline away.</h2>
          <p className="mt-4 text-lg text-white/85">
            Reserve your ZIP codes, deploy your AI agent, and start capturing borrowers who are yours to keep.
          </p>
          <a
            href="#territories"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-amber-400 px-8 py-4 text-base font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Claim your ZIP territory
          </a>
          <p className="mt-4 text-xs text-white/60">
            Prefer analytics? <Link href="/analytics" className="underline hover:text-white">View the live intake ledger →</Link>
          </p>
        </div>
      </section>

      <SiteFooter />

      {/* Mobile sticky conversion bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#09081b]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <a
          href="#territories"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/30 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          Claim your ZIP territory — free
        </a>
      </div>
    </div>
  );
}
