"use client";

import { useState } from "react";
import { usePredictLead } from "@/lib/hooks/usePredictLead";
import type { Lead } from "@/lib/agents/predictiveAgent";
import { Card, ErrorNote, GenerateButton } from "./dashboard-shell";

function makeLead(name: string, zip: string, tags: string[]): Lead {
  return {
    id: `manual_${Date.now()}`,
    name,
    zip,
    tags,
    createdAt: new Date().toISOString(),
  };
}

export function LifeEventPanel() {
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitted, setSubmitted] = useState<{ lead: Lead; zip: string } | null>(null);

  const result = usePredictLead(submitted?.lead ?? null, submitted?.zip ?? null);

  function submit() {
    if (!name.trim() || !/^\d{5}$/.test(zip)) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setSubmitted({ lead: makeLead(name.trim(), zip, tags), zip });
  }

  return (
    <Card title="Life-event likelihood">
      <p className="text-sm text-slate-600">
        Rule-based scoring across rental demand, census signals, and county-level life events (divorce, marriage,
        probate, migration) for a given lead + ZIP.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lead name"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="ZIP code"
          inputMode="numeric"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="tags: investor, renter…"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <GenerateButton onClick={submit} loading={result.loading}>
          Score lead
        </GenerateButton>
      </div>

      <div className="mt-4">
        <ErrorNote error={result.error} />
      </div>

      {result.data ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-800">
              Lead score {Math.round(result.data.leadScore)}
            </span>
            <span className="rounded-full bg-cyan-100 px-4 py-1.5 text-sm font-semibold text-cyan-800">
              Life-event likelihood {Math.round(result.data.lifeEventLikelihood)}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{result.data.recommendedAction}</p>
          <ul className="space-y-1 text-sm text-slate-600">
            {result.data.reasons.map((reason) => (
              <li key={reason} className="rounded-xl bg-slate-50 p-2">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
