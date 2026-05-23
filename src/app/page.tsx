import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoanPilotFloatingIntake } from "@/components/loanpilot-floating-assistant";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mortgage borrower intake that converts qualified leads",
  description:
    "Launch a conversion-focused AI mortgage intake rail with program-fit scoring, LOS-ready CRM sync, loan officer routing, borrower nurture, and calendar booking.",
  alternates: {
    canonical: "/",
  },
};

const navigation = [
  { href: "#conversion", label: "Conversion engine" },
  { href: "#proof", label: "Satisfaction metrics" },
  { href: "#site-map", label: "Site links" },
  { href: "/analytics", label: "Analytics" },
  { href: "/embed/intake", label: "Embed" },
];

const proofPoints = [
  "Program-fit scoring for FHA, VA, DSCR, HELOC, refinance, and jumbo leads",
  "CRM notes and LOS officer pings created as soon as the borrower qualifies",
  "SMS, email, nurture, and calendar booking rails tied to every intake session",
];

const satisfactionSignals = [
  { label: "Borrower clarity score", value: "98", detail: "Plain-language prompts reduce form fatigue" },
  { label: "Speed-to-lead target", value: "<60s", detail: "Hot borrowers route to an officer immediately" },
  { label: "Handoff confidence", value: "A+", detail: "LOS-ready summaries keep follow-up consistent" },
];

const siteLinks = [
  {
    href: "/",
    title: "Conversion home",
    description: "Hero, proof, CTAs, and the floating AI intake concierge.",
  },
  {
    href: "/analytics",
    title: "Analytics ledger",
    description: "Completion, booking, qualification, and program demand telemetry.",
  },
  {
    href: "/embed/intake",
    title: "Embed intake",
    description: "Iframe-friendly borrower intake rail for partner and YPN surfaces.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: siteName,
      url: absoluteUrl("/"),
      description:
        "AI mortgage borrower intake, qualification, LOS sync, nurture automation, and booking.",
      potentialAction: {
        "@type": "Action",
        name: "Start borrower intake",
        target: absoluteUrl("/embed/intake"),
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${absoluteUrl("/")}#software`,
      name: siteName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description:
        "LoanPilot AI captures mortgage borrower facts, scores program fit, mirrors CRM artifacts, routes loan officers, automates nurture, and books next steps.",
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        category: "Mortgage automation software",
      },
    },
  ],
};

export default function Landing() {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div className="loanpilot-aurora pointer-events-none absolute inset-0" aria-hidden />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-6 py-6 text-white md:py-8">
        <header className="flex flex-col gap-4 rounded-full border border-white/15 bg-white/10 px-5 py-4 shadow-2xl shadow-slate-950/20 backdrop-blur md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-sm font-black uppercase tracking-[0.28em] text-cyan-100">
            LoanPilot AI
          </Link>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <section className="grid items-center gap-12 lg:grid-cols-[1fr_0.95fr]">
          <div className="max-w-2xl space-y-8">
            <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100">
              Mortgage AI intake · Built for conversion
            </span>

            <div className="space-y-5">
              <h1 className="text-balance text-4xl font-black leading-[1.04] tracking-[-0.04em] md:text-6xl">
                Convert mortgage traffic into qualified borrower conversations.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-white/90">
                Replace static lead forms with an AI intake concierge that captures borrower intent, scores program fit,
                syncs LOS-ready CRM notes, routes loan officers, and books the next step while the lead is still warm.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm font-black">
              <Link
                href="/embed/intake"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-teal-800 shadow-xl shadow-teal-500/35 transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                Start AI borrower intake
              </Link>
              <Link
                href="/analytics"
                className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-3 text-white shadow-inner backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                View conversion analytics
              </Link>
            </div>

            <ul id="conversion" className="grid gap-3 text-sm font-semibold text-white/95">
              {proofPoints.map((item) => (
                <li key={item} className="rounded-3xl bg-white/5 px-5 py-3 ring-1 ring-white/25 backdrop-blur">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[36px] border border-white/25 bg-white/10 p-3 shadow-2xl shadow-slate-950/35 backdrop-blur">
            <div className="overflow-hidden rounded-[28px] bg-white">
              <Image
                src="/loanpilot-hero-dashboard.svg"
                alt="LoanPilot AI dashboard showing borrower qualification score, LOS sync, and calendar booking automation"
                width={760}
                height={560}
                sizes="(max-width: 1024px) 100vw, 48vw"
                preload
                className="h-auto w-full"
              />
            </div>
            <div className="grid gap-3 px-2 pb-2 pt-4 text-xs font-bold uppercase tracking-[0.2em] text-cyan-50 sm:grid-cols-3">
              <span>Low CLS visual</span>
              <span>Fast LCP asset</span>
              <span>Clear next step</span>
            </div>
          </div>
        </section>

        <section id="proof" className="grid gap-4 md:grid-cols-3" aria-labelledby="proof-heading">
          <div className="md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-100">Satisfaction metrics</p>
            <h2 id="proof-heading" className="mt-2 text-3xl font-black tracking-[-0.03em]">
              Built to keep borrowers moving and search quality signals clean.
            </h2>
          </div>
          {satisfactionSignals.map((metric) => (
            <article key={metric.label} className="rounded-[30px] border border-white/20 bg-white/95 p-6 text-slate-950 shadow-2xl shadow-slate-950/20">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
              <p className="mt-4 text-4xl font-black text-teal-700">{metric.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section id="site-map" className="grid gap-4 rounded-[34px] border border-white/20 bg-white/10 p-5 backdrop-blur md:grid-cols-3" aria-labelledby="site-map-heading">
          <div className="md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-100">Connected website</p>
            <h2 id="site-map-heading" className="mt-2 text-2xl font-black">Every public surface links into the conversion journey.</h2>
          </div>
          {siteLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-[26px] bg-white p-5 text-slate-950 shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5">
              <span className="text-sm font-black">{item.title}</span>
              <span className="mt-3 block text-sm leading-6 text-slate-600">{item.description}</span>
            </Link>
          ))}
        </section>

        <p className="pb-4 text-center text-xs font-bold uppercase tracking-[0.32em] text-white/70">
          Tip: tap “AI intake concierge” in the bottom-right corner to test the floating conversion rail.
        </p>
      </div>

      <LoanPilotFloatingIntake funnelSource="experience_hero_wave" />
    </main>
  );
}
