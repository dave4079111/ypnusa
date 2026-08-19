"use client";

import Link from "next/link";
import { useContentPatterns } from "@/lib/hooks/useContentPatterns";
import { useSiloBuilder } from "@/lib/hooks/useSiloBuilder";
import { Card } from "./dashboard-shell";

export function SiloOverviewPanel() {
  const { patterns, hydrated } = useContentPatterns();
  const { groups, recommendations } = useSiloBuilder(patterns);

  if (hydrated && patterns.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          No content ingested yet.{" "}
          <Link href="/dashboard/content" className="font-semibold text-violet-700">
            Paste WordPress content
          </Link>{" "}
          first, then come back here to see silo classification.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {(Object.keys(groups) as (keyof typeof groups)[]).map((silo) => {
        const items = groups[silo];
        const recommendation = recommendations.find((r) => r.silo === silo);
        return (
          <Card key={silo} title={`${silo} (${items.length})`}>
            {recommendation ? (
              <p className="text-sm text-slate-600">{recommendation.reasoning}</p>
            ) : (
              <p className="text-sm text-slate-400">No patterns in this silo yet.</p>
            )}
            {recommendation ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                Funnel: {recommendation.funnelType.replace(/_/g, " ")}
              </p>
            ) : null}
            <ul className="mt-4 space-y-2">
              {items.map((pattern, i) => (
                <li key={`${pattern.title}_${i}`} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                  {pattern.title}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
