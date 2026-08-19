"use client";

import { useState } from "react";
import Link from "next/link";
import { useContentPatterns } from "@/lib/hooks/useContentPatterns";
import { useFunnelBuilder } from "@/lib/hooks/useFunnelBuilder";
import { Card, GenerateButton } from "./dashboard-shell";

export function FunnelBuilderPanel() {
  const { patterns, hydrated } = useContentPatterns();
  const { funnel, generate } = useFunnelBuilder();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [brandVoice, setBrandVoice] = useState("warm and direct");
  const [audience, setAudience] = useState("your ideal customer");

  if (hydrated && patterns.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          No content ingested yet.{" "}
          <Link href="/dashboard/content" className="font-semibold text-violet-700">
            Paste WordPress content
          </Link>{" "}
          first, then build a funnel from it here.
        </p>
      </Card>
    );
  }

  const selected = patterns[selectedIndex];

  return (
    <>
      <Card title="Build a funnel from a pattern">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none sm:col-span-3"
          >
            {patterns.map((pattern, i) => (
              <option key={`${pattern.title}_${i}`} value={i}>
                {pattern.title} ({pattern.silo})
              </option>
            ))}
          </select>
          <input
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="Brand voice"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          />
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Audience"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none sm:col-span-2"
          />
        </div>

        <div className="mt-4">
          <GenerateButton onClick={() => selected && generate(selected, brandVoice, audience)}>
            Generate landing page + email sequence
          </GenerateButton>
        </div>
      </Card>

      {funnel ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Landing page">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
              Funnel: {funnel.funnelType.replace(/_/g, " ")}
            </p>
            <div className="mt-3 space-y-3">
              {funnel.landingPage.sections.map((section) => (
                <div key={section.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{section.headline}</p>
                  <p className="text-xs text-slate-500">{section.subheadline}</p>
                  <p className="mt-1 text-sm text-slate-700">{section.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Email sequence">
            <div className="space-y-3">
              {funnel.emailSequence.map((email, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{email.subject}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{email.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Social posts">
            <div className="space-y-3">
              {funnel.socialPosts.map((post, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">{post.channel}</p>
                  <p className="mt-1 text-sm text-slate-700">{post.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="CTA blocks">
            <div className="space-y-2">
              {funnel.ctaBlocks.map((cta, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  {cta.label}
                  {cta.url ? <span className="ml-2 text-xs text-slate-400">{cta.url}</span> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
