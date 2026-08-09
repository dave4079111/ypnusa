"use client";

import { useEffect, useMemo, useState } from "react";
import type { PricingTierId } from "@/lib/pricing";
import type { RevenueFlowStage, RevenuePulseSummary, RevenueTierSummary } from "@/lib/revenue";

type TierFilter = PricingTierId | "all";

interface RevenueBreakdownProps {
  initialData: RevenuePulseSummary;
}

interface RevenueSummaryResponse {
  ok: boolean;
  data?: RevenuePulseSummary;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function money(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

function compactMoney(cents: number): string {
  return `$${compactFormatter.format(cents / 100)}`;
}

function generatedTime(iso: string): string {
  return `${iso.slice(11, 19)} UTC`;
}

function tierAccent(tierId: PricingTierId): string {
  switch (tierId) {
    case "free":
      return "from-slate-300 to-slate-500";
    case "starter":
      return "from-cyan-300 to-cyan-600";
    case "pro":
      return "from-teal-300 to-emerald-500";
    case "elite":
      return "from-violet-400 to-cyan-400";
    default: {
      const exhaustive: never = tierId;
      return exhaustive;
    }
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-cyan-50/70">{detail}</p>
    </article>
  );
}

function TierPanel({ tier }: { tier: RevenueTierSummary }) {
  const activeWidth = Math.max(tier.sharePct, tier.bookings > 0 ? 5 : 0);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-100/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{tier.tierName}</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{money(tier.monthlyRevenueCents)}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {tier.bookings} bookings
        </span>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tierAccent(tier.tierId)}`}
          style={{ width: `${activeWidth}%` }}
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">ZIP bookings</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {tier.zipBookingCount} / {money(tier.zipRevenueCents)}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">County bookings</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {tier.countyBookingCount} / {money(tier.countyRevenueCents)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-slate-600">{tier.capacityNote}</p>
      <p className="mt-1 text-xs font-medium text-cyan-700">{tier.countyCapacityNote}</p>
    </article>
  );
}

function RevenueFlow({
  stages,
  activeStage,
  setActiveStage,
}: {
  stages: RevenueFlowStage[];
  activeStage: RevenueFlowStage;
  setActiveStage: (stage: RevenueFlowStage) => void;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl shadow-cyan-950/30">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Pipeline to subscription flow</p>
          <h2 className="mt-2 text-2xl font-semibold">How borrower demand turns into territory MRR</h2>
        </div>
        <p className="max-w-md text-sm text-slate-300">{activeStage.detail}</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            onFocus={() => setActiveStage(stage)}
            onMouseEnter={() => setActiveStage(stage)}
            className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition ${
              activeStage.id === stage.id
                ? "border-cyan-300 bg-white text-slate-950"
                : "border-white/10 bg-white/10 text-white hover:border-cyan-300/70"
            }`}
          >
            <span className="text-xs uppercase tracking-[0.2em] opacity-70">Step {index + 1}</span>
            <span className="mt-3 block text-lg font-semibold">{stage.label}</span>
            <span className="mt-4 block text-4xl font-bold">{stage.count}</span>
            <span className="mt-2 block text-sm opacity-75">{compactMoney(stage.valueCents)} value</span>
            <span className="mt-5 inline-flex rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200">
              {stage.conversionPct}% conversion
            </span>
            {index < stages.length - 1 ? (
              <svg
                aria-hidden="true"
                className="absolute -right-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 text-cyan-300 lg:block"
                viewBox="0 0 32 32"
                fill="none"
              >
                <path
                  d="M4 16h21m0 0-8-8m8 8-8 8"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

export function RevenueBreakdown({ initialData }: RevenueBreakdownProps) {
  const [summary, setSummary] = useState(initialData);
  const [selectedTier, setSelectedTier] = useState<TierFilter>("all");
  const [activeStage, setActiveStage] = useState(initialData.flow.stages[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setIsRefreshing(true);
      try {
        const response = await fetch("/api/revenue/summary", { cache: "no-store" });
        const payload = (await response.json()) as RevenueSummaryResponse;
        if (!cancelled && payload.ok && payload.data) {
          setSummary(payload.data);
          setActiveStage((current) => {
            return payload.data?.flow.stages.find((stage) => stage.id === current.id) ?? payload.data!.flow.stages[0];
          });
        }
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }

    const interval = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const visibleTiers = useMemo(() => {
    if (selectedTier === "all") return summary.tierBreakdown;
    return summary.tierBreakdown.filter((tier) => tier.tierId === selectedTier);
  }, [selectedTier, summary.tierBreakdown]);

  const filterButtons: Array<{ id: TierFilter; label: string }> = [
    { id: "all", label: "All tiers" },
    ...summary.tierBreakdown.map((tier) => ({ id: tier.tierId, label: tier.tierName })),
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-cyan-950/30 md:p-8">
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Monetization control room</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                Visual Revenue Breakdown
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Real-time demo revenue from territory subscriptions, borrower demand, booked consults, and MLO
                lifetime value.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-cyan-50">
              <p className="font-semibold">Live refresh</p>
              <p className="mt-1 text-cyan-100/70">
                Updated {generatedTime(summary.generatedAt)}
                {isRefreshing ? " / syncing" : " / every 15s"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="MRR"
              value={money(summary.totals.mrrCents)}
              detail={`${summary.totals.activeSubscriptions} active/trial subscriptions`}
            />
            <MetricCard
              label="Territory coverage"
              value={`${summary.totals.claimedZipCount} ZIPs`}
              detail={`${summary.totals.countyTerritoryCount} county territories booked`}
            />
            <MetricCard
              label="Avg LTV / MLO"
              value={money(summary.totals.averageLtvPerMloCents)}
              detail="Subscription LTV plus attributed pipeline"
            />
            <MetricCard
              label="Demand ledger"
              value={`${summary.totals.borrowerLeadCount} leads`}
              detail={`${summary.totals.demoRequestCount} demos / ${summary.totals.analyticsEventCount} events`}
            />
          </div>
        </div>
      </section>

      <RevenueFlow
        stages={summary.flow.stages}
        activeStage={activeStage}
        setActiveStage={setActiveStage}
      />

      <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-600">County / ZIP bookings</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Tier revenue mix</h2>
            <p className="mt-2 text-sm text-slate-600">
              Revenue is allocated across ZIP and county coverage units inside each subscription.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((button) => (
              <button
                key={button.id}
                type="button"
                onClick={() => setSelectedTier(button.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedTier === button.id
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-cyan-100 hover:text-cyan-900"
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {visibleTiers.map((tier) => (
            <TierPanel key={tier.tierId} tier={tier} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-[2rem] bg-white p-6 shadow-xl shadow-cyan-100/70 ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-600">Lifetime value per MLO</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">MLO monetization roster</h2>
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100">
            {summary.ltvByMlo.map((mlo) => (
              <div
                key={mlo.loId}
                className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[1.2fr_0.8fr_0.8fr]"
              >
                <div>
                  <p className="font-semibold text-slate-950">{mlo.name}</p>
                  <p className="text-sm text-slate-500">{mlo.email}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-700">
                    {mlo.planNames.length > 0 ? mlo.planNames.join(" + ") : "No paid plan"}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>
                    {mlo.leadCount} leads / {mlo.bookedLeadCount} booked
                  </p>
                  <p>{mlo.demoRequestCount} attributed demos</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xl font-semibold text-slate-950">{money(mlo.lifetimeValueCents)}</p>
                  <p className="text-sm text-slate-500">{money(mlo.monthlyRevenueCents)} MRR</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[2rem] border border-cyan-100 bg-cyan-50 p-6 text-cyan-950">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-700">Model assumptions</p>
          <ul className="mt-5 space-y-3 text-sm leading-6">
            {summary.assumptions.map((assumption) => (
              <li key={assumption} className="rounded-2xl bg-white/80 p-3 shadow-sm shadow-cyan-100">
                {assumption}
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}
