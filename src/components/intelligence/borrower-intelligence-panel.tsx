"use client";

import { useState } from "react";
import { useBorrowerProfile } from "@/lib/hooks/useBorrowerProfile";
import { useOutcomePrediction } from "@/lib/hooks/useOutcomePrediction";
import type { BorrowerProfileBasics } from "@/lib/borrower/profileEngine";
import type { Lead } from "@/lib/agents/predictiveAgent";
import { Card, ErrorNote, GenerateButton } from "./dashboard-shell";

const CREDIT_OPTIONS = ["excellent", "good", "fair", "building", "unsure"] as const;
type CreditConfidence = (typeof CREDIT_OPTIONS)[number];

export function BorrowerIntelligencePanel() {
  const [zip, setZip] = useState("");
  const [goal, setGoal] = useState("purchase a home");
  const [timeline, setTimeline] = useState("1_3_months");
  const [propertyType, setPropertyType] = useState("");
  const [creditConfidence, setCreditConfidence] = useState<CreditConfidence>("unsure");
  const [incomeRange, setIncomeRange] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const profile = useBorrowerProfile();
  const outcome = useOutcomePrediction();

  async function generate() {
    if (!/^\d{5}$/.test(zip)) return;

    const borrower: BorrowerProfileBasics = {
      zip,
      goal,
      timeline,
      propertyType: propertyType || undefined,
      creditConfidence,
      incomeRange: incomeRange || undefined,
    };
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const lead: Lead = { id: `manual_${Date.now()}`, name: "Borrower", zip, tags, createdAt: new Date().toISOString() };

    await Promise.all([profile.generate(borrower, lead), outcome.predict(lead, zip)]);
  }

  return (
    <>
      <Card title="Borrower profile + outcome prediction">
        <p className="text-sm text-slate-600">
          Combines borrower-stated intent with ZIP/county context into a persona, confidence score, and
          signup/insight-request/conversion/follow-up likelihoods.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="ZIP code"
            inputMode="numeric"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Goal"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          />
          <select
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          >
            <option value="lt_30">Under 30 days</option>
            <option value="1_3_months">1-3 months</option>
            <option value="3_6_months">3-6 months</option>
            <option value="researching">Just researching</option>
          </select>
          <input
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            placeholder="Property type (optional)"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          />
          <select
            value={creditConfidence}
            onChange={(e) => setCreditConfidence(e.target.value as CreditConfidence)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          >
            {CREDIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            value={incomeRange}
            onChange={(e) => setIncomeRange(e.target.value)}
            placeholder="Income range (optional)"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="tags: investor, renter…"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none sm:col-span-3"
          />
        </div>

        <div className="mt-4">
          <GenerateButton onClick={generate} loading={profile.loading || outcome.loading}>
            Generate profile + outcome
          </GenerateButton>
        </div>

        <div className="mt-4">
          <ErrorNote error={profile.error ?? outcome.error} />
        </div>
      </Card>

      {profile.data ? (
        <Card title="Borrower profile">
          <p className="text-sm font-semibold text-slate-950">{profile.data.persona}</p>
          <p className="mt-2 text-sm text-slate-700">{profile.data.intentSummary}</p>
          <span className="mt-3 inline-flex rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-800">
            Confidence {Math.round(profile.data.confidenceScore)}
          </span>
          <p className="mt-3 text-sm text-slate-600">{profile.data.timelinePrediction}</p>
          <p className="mt-3 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">{profile.data.whyThisMattersForYou}</p>
          <ul className="mt-3 space-y-1">
            {profile.data.ctaRecommendations.map((cta) => (
              <li key={cta} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                {cta}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {outcome.data ? (
        <Card title="Outcome prediction">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Signup likelihood</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{Math.round(outcome.data.signupLikelihood)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                Insight request likelihood
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {Math.round(outcome.data.insightRequestLikelihood)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Conversion likelihood</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {Math.round(outcome.data.conversionLikelihood)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Follow-up necessity</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{Math.round(outcome.data.followUpNecessity)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{outcome.data.rationale}</p>
        </Card>
      ) : null}
    </>
  );
}
