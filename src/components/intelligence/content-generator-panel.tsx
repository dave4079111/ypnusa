"use client";

import { useState } from "react";
import { useMarketing } from "@/lib/hooks/useMarketing";
import { useGMB } from "@/lib/hooks/useGMB";
import { useWebsiteBuilder } from "@/lib/hooks/useWebsiteBuilder";
import type { PlatformChannel } from "@/lib/agents/marketingAgent";
import type { GmbGoal } from "@/lib/agents/gmbAgent";
import { Card, ErrorNote, GenerateButton } from "./dashboard-shell";

const CHANNELS: PlatformChannel[] = ["facebook", "instagram", "linkedin", "email", "sms", "ad"];
const GMB_GOALS: GmbGoal[] = ["update", "promotion", "announcement"];

function ResultBlock({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-cyan-100">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function MarketingGenerator() {
  const marketing = useMarketing();
  const [brandVoice, setBrandVoice] = useState("confident and friendly");
  const [goal, setGoal] = useState("claim your exclusive ZIP territory");
  const [audience, setAudience] = useState("mortgage loan officers");
  const [channel, setChannel] = useState<PlatformChannel>("facebook");
  const [topic, setTopic] = useState("");

  const request = { brandVoice, goal, audience, channel, topic: topic || undefined };

  return (
    <div>
      <h3 className="text-lg font-semibold">Marketing copy</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} placeholder="Brand voice"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none sm:col-span-2" />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <select value={channel} onChange={(e) => setChannel(e.target.value as PlatformChannel)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none">
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <GenerateButton onClick={() => marketing.socialPost.generate(request)} loading={marketing.socialPost.loading}>
          Social post
        </GenerateButton>
        <GenerateButton onClick={() => marketing.email.generate(request)} loading={marketing.email.loading}>
          Email
        </GenerateButton>
        <GenerateButton onClick={() => marketing.adCopy.generate(request)} loading={marketing.adCopy.loading}>
          Ad copy
        </GenerateButton>
      </div>

      <ErrorNote error={marketing.socialPost.error ?? marketing.email.error ?? marketing.adCopy.error} />
      <ResultBlock data={marketing.socialPost.data ?? marketing.email.data ?? marketing.adCopy.data} />
    </div>
  );
}

function GmbGenerator() {
  const gmb = useGMB();
  const [name, setName] = useState("YPN Mortgage");
  const [city, setCity] = useState("Fresno");
  const [services, setServices] = useState("FHA loans, VA loans");
  const [keywords, setKeywords] = useState("fresno mortgage broker");
  const [goal, setGoal] = useState<GmbGoal>("update");

  const profile = {
    name,
    city,
    services: services.split(",").map((s) => s.trim()).filter(Boolean),
    keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
  };

  return (
    <div className="mt-8 border-t border-slate-100 pt-8">
      <h3 className="text-lg font-semibold">Google Business Profile</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={services} onChange={(e) => setServices(e.target.value)} placeholder="Services (comma-separated)"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords (comma-separated)"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <select value={goal} onChange={(e) => setGoal(e.target.value as GmbGoal)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none">
          {GMB_GOALS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <GenerateButton onClick={() => gmb.post.generate(profile, goal)} loading={gmb.post.loading}>
          Generate post
        </GenerateButton>
        <GenerateButton onClick={() => gmb.description.generate(profile)} loading={gmb.description.loading}>
          Optimize description
        </GenerateButton>
      </div>

      <ErrorNote error={gmb.post.error ?? gmb.description.error} />
      <ResultBlock data={gmb.post.data ?? gmb.description.data} />
    </div>
  );
}

function WebsiteBuilderGenerator() {
  const builder = useWebsiteBuilder();
  const [goal, setGoal] = useState("claim your ZIP territory");
  const [audience, setAudience] = useState("loan officers");
  const [sections, setSections] = useState("hero, features, testimonials, faq");
  const [offer, setOffer] = useState("50% off your first month");

  return (
    <div className="mt-8 border-t border-slate-100 pt-8">
      <h3 className="text-lg font-semibold">Website / landing page builder</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={sections} onChange={(e) => setSections(e.target.value)} placeholder="Sections (comma-separated)"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Offer (for landing page)"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <GenerateButton
          onClick={() =>
            builder.pageSpec.generate(goal, audience, sections.split(",").map((s) => s.trim()).filter(Boolean))
          }
          loading={builder.pageSpec.loading}
        >
          Generate page spec
        </GenerateButton>
        <GenerateButton onClick={() => builder.landingPage.generate(goal, offer)} loading={builder.landingPage.loading}>
          Generate landing page
        </GenerateButton>
      </div>

      <ErrorNote error={builder.pageSpec.error ?? builder.landingPage.error} />
      <ResultBlock data={builder.pageSpec.data ?? builder.landingPage.data} />
    </div>
  );
}

export function ContentGeneratorPanel() {
  return (
    <Card>
      <MarketingGenerator />
      <GmbGenerator />
      <WebsiteBuilderGenerator />
    </Card>
  );
}
