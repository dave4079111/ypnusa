"use client";

import { useState } from "react";
import { useContentPatterns } from "@/lib/hooks/useContentPatterns";
import { Card, GenerateButton } from "./dashboard-shell";

const SILO_BADGE: Record<string, string> = {
  "Life Events": "bg-rose-100 text-rose-800",
  "Predictive Intelligence": "bg-cyan-100 text-cyan-800",
  Tools: "bg-amber-100 text-amber-800",
  Guides: "bg-slate-100 text-slate-800",
};

export function ContentIngestionPanel() {
  const { patterns, addPattern, removePattern, reset } = useContentPatterns();
  const [raw, setRaw] = useState("");

  function parse() {
    if (!raw.trim()) return;
    addPattern(raw);
    setRaw("");
  }

  return (
    <>
      <Card title="Ingest WordPress content">
        <p className="text-sm text-slate-600">
          Paste raw HTML or Markdown from ypnus.com. Headings, CTAs, and offers are extracted and classified into a
          silo automatically — the result is shared with the Silos and Funnels pages.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder="<h1>Going Through a Divorce?</h1><p>...</p>"
          className="mt-4 w-full rounded-2xl border border-slate-300 p-4 font-mono text-xs focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-4 flex gap-3">
          <GenerateButton onClick={parse}>Parse content</GenerateButton>
          {patterns.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-400"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </Card>

      {patterns.length > 0 ? (
        <Card title={`Parsed patterns (${patterns.length})`}>
          <div className="space-y-4">
            {patterns.map((pattern, index) => (
              <article key={`${pattern.title}_${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${SILO_BADGE[pattern.silo] ?? "bg-slate-100 text-slate-800"}`}>
                      {pattern.silo}
                    </span>
                    <h3 className="mt-2 font-semibold text-slate-950">{pattern.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePattern(index)}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {pattern.sections.length} section(s) · {pattern.ctas.length} CTA(s) · {pattern.offers.length} offer(s)
                </p>
              </article>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
