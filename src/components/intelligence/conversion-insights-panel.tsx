"use client";

import { useEffect, useState } from "react";
import { usePersonalization } from "@/lib/hooks/usePersonalization";
import { useCTAEngine } from "@/lib/hooks/useCTAEngine";
import { Card, ErrorNote, GenerateButton } from "./dashboard-shell";

interface PreLeadFunnelCounts {
  viewed: number;
  clickedCta: number;
  startedSignup: number;
  completedSignup: number;
  viewedDashboard: number;
  requestedInsights: number;
}

const FUNNEL_LABELS: Array<{ key: keyof PreLeadFunnelCounts; label: string }> = [
  { key: "viewed", label: "Viewed borrower page" },
  { key: "clickedCta", label: "Clicked CTA" },
  { key: "startedSignup", label: "Started signup" },
  { key: "completedSignup", label: "Completed signup" },
  { key: "viewedDashboard", label: "Viewed dashboard" },
  { key: "requestedInsights", label: "Requested insights" },
];

/** Pulls preLeadFunnel from the existing /api/analytics/summary route — no new endpoint needed. */
function PreLeadFunnelCard() {
  const [counts, setCounts] = useState<PreLeadFunnelCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/summary", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: { ok?: boolean; analytics?: { preLeadFunnel?: PreLeadFunnelCounts } }) => {
        if (!cancelled && payload.ok && payload.analytics?.preLeadFunnel) {
          setCounts(payload.analytics.preLeadFunnel);
        }
      })
      .catch(() => {
        /** leave counts null — card just won't render */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!counts) return null;

  return (
    <Card title="Pre-lead funnel">
      <p className="text-sm text-slate-600">
        Anonymous funnel progress recorded via stageTracker before a borrower lead exists.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {FUNNEL_LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{counts[key]}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ConversionInsightsPanel() {
  const [zip, setZip] = useState("");
  const personalization = usePersonalization();
  const cta = useCTAEngine();

  async function run() {
    if (!/^\d{5}$/.test(zip)) return;
    const result = await personalization.generate(zip);
    await cta.generate({
      zip,
      county: result?.zipContext?.county,
      personalization: result?.personalization,
    });
  }

  return (
    <>
      <Card title="Conversion insights">
        <p className="text-sm text-slate-600">
          Personalization + CTA output for a given ZIP — the same engines that back the ZIP checker and territory
          claim flow on the homepage.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="ZIP code"
            inputMode="numeric"
            className="w-40 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          />
          <GenerateButton onClick={run} loading={personalization.loading || cta.loading}>
            Generate insights
          </GenerateButton>
        </div>
        <div className="mt-4">
          <ErrorNote error={personalization.error ?? cta.error} />
        </div>
      </Card>

      {personalization.data?.personalization ? (
        <Card title="ZIP demand indicators">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">ZIP demand</dt>
              <dd className="mt-2 text-sm text-slate-800">{personalization.data.personalization.zipDemandSummary}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Life-event likelihood</dt>
              <dd className="mt-2 text-sm text-slate-800">{personalization.data.personalization.lifeEventSummary}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Remodel ROI teaser</dt>
              <dd className="mt-2 text-sm text-slate-800">{personalization.data.personalization.remodelRoiTeaser}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Rental demand teaser</dt>
              <dd className="mt-2 text-sm text-slate-800">{personalization.data.personalization.rentalDemandTeaser}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">
            {personalization.data.personalization.whyThisMattersForYou}
          </p>
        </Card>
      ) : null}

      {cta.data ? (
        <Card title="CTA performance set">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Primary</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{cta.data.primary.label}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Secondary</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{cta.data.secondary.label}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Social share</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{cta.data.socialShare.label}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Dashboard</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{cta.data.dashboard.label}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {cta.data.microNudges.map((nudge, i) => (
              <p key={i} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {nudge}
              </p>
            ))}
          </div>
        </Card>
      ) : null}

      <PreLeadFunnelCard />
    </>
  );
}
