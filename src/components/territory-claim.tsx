"use client";

import { useState } from "react";
import { marketingUrl } from "@/lib/site";

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "result";
      zip: string;
      available: boolean;
      totalClaimed: number;
      message: string;
      city?: string | null;
      state?: string | null;
      signupUrl?: string | null;
      demandTotal?: number | null;
      source?: string | null;
    }
  | { status: "error"; message: string };

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

const VOLUME_OPTIONS = [
  "Just me (solo LO)",
  "2–5 loan officers",
  "6–20 loan officers",
  "Whole brokerage / branch",
];

const MARKETING_SIGNUP = marketingUrl("/lo-signup.html");

function signupHrefFor(zip?: string, plan = "free") {
  const params = new URLSearchParams({ plan });
  if (zip) params.set("zip", zip);
  return `${MARKETING_SIGNUP}?${params.toString()}`;
}

export function TerritoryClaim({ source = "territory_section" }: { source?: string }) {
  const [zip, setZip] = useState("");
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const [form, setForm] = useState({
    name: "",
    workEmail: "",
    company: "",
    phone: "",
    role: "Loan officer",
    monthlyLeadVolume: VOLUME_OPTIONS[0],
    message: "",
  });

  async function runCheck() {
    if (check.status === "checking") return;
    const clean = zip.replace(/\D/g, "").slice(0, 5);
    setZip(clean);
    if (clean.length !== 5) {
      setCheck({ status: "error", message: "Enter a valid 5-digit ZIP code." });
      return;
    }
    setCheck({ status: "checking" });
    setSubmit({ status: "idle" });
    try {
      const res = await fetch(`/api/territory/check?zip=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        setCheck({ status: "error", message: "Couldn't check that territory — try again." });
        return;
      }
      const data = (await res.json()) as {
        zip: string;
        valid: boolean;
        available: boolean;
        totalClaimed: number;
        message: string;
        city?: string | null;
        state?: string | null;
        signupUrl?: string | null;
        demand?: { total?: number } | null;
        source?: string | null;
      };
      if (!data.valid) {
        setCheck({ status: "error", message: data.message });
        return;
      }
      setCheck({
        status: "result",
        zip: data.zip,
        available: data.available,
        totalClaimed: data.totalClaimed,
        message: data.message,
        city: data.city,
        state: data.state,
        signupUrl: data.signupUrl,
        demandTotal: data.demand?.total ?? null,
        source: data.source,
      });
    } catch {
      setCheck({ status: "error", message: "Couldn't reach the territory service — try again." });
    }
  }

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    if (submit.status === "submitting") return;
    if (!form.name.trim() || !form.workEmail.trim() || !form.company.trim()) {
      setSubmit({ status: "error", message: "Name, work email, and company are required." });
      return;
    }
    setSubmit({ status: "submitting" });
    try {
      const query = new URLSearchParams(window.location.search);
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          zip: check.status === "result" ? check.zip : zip,
          source,
          utmSource: query.get("utm_source") ?? undefined,
          utmMedium: query.get("utm_medium") ?? undefined,
          utmCampaign: query.get("utm_campaign") ?? undefined,
          clickId: query.get("gclid") ?? query.get("fbclid") ?? undefined,
          referrer: document.referrer || undefined,
          landingPage: window.location.href,
          correlationId: crypto.randomUUID(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!data.ok) {
        setSubmit({ status: "error", message: data.error ?? "Something went wrong — try again." });
        return;
      }
      setSubmit({ status: "done", message: data.message ?? "You're in — we'll be in touch shortly." });
    } catch {
      setSubmit({ status: "error", message: "Network error — try again in a moment." });
    }
  }

  const showForm = check.status === "result";
  const claimed = check.status === "result" && !check.available;
  const place =
    check.status === "result" && check.city && check.state
      ? `${check.city}, ${check.state}`
      : check.status === "result"
        ? `ZIP ${check.zip}`
        : "";
  const signupHref =
    check.status === "result"
      ? check.signupUrl || signupHrefFor(check.zip)
      : signupHrefFor();
  const resultTitle =
    check.status === "result"
      ? check.available
        ? `${place} is open for paid territory activation`
        : `${place} is claimed — join the waitlist`
      : "";

  return (
    <div className="w-full rounded-[28px] border border-white/15 bg-white/[0.06] p-6 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-8">
      <label htmlFor="territory-zip" className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200">
        Check your territory
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="territory-zip"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter ZIP code (e.g. 92672)"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runCheck();
            }
          }}
          className="w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none ring-violet-300 transition placeholder:font-normal placeholder:text-slate-400 focus:ring-2"
        />
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={check.status === "checking"}
          className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          aria-busy={check.status === "checking"}
        >
          {check.status === "checking" ? "Checking…" : "Check availability"}
        </button>
      </div>

      <div aria-live="polite" role="status" className="mt-4 min-h-[172px]">
        {check.status === "idle" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white/70">
            <p className="font-medium text-white">Instant ZIP availability</p>
            <p className="mt-1 text-[13px]">
              Enter a 5-digit ZIP to check availability, then request the territory or continue to verified signup and billing.
            </p>
          </div>
        ) : null}

        {check.status === "checking" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-3/5 rounded-full bg-white/20" />
              <div className="h-3 w-full rounded-full bg-white/10" />
              <div className="h-3 w-4/5 rounded-full bg-white/10" />
              <div className="h-9 w-40 rounded-full bg-amber-300/50" />
            </div>
          </div>
        ) : null}

        {check.status === "error" ? (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
            <p className="font-semibold">We could not check that ZIP.</p>
            <p className="mt-1 text-rose-100/80">{check.message}</p>
            <button
              type="button"
              className="mt-3 rounded-full border border-rose-200/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              onClick={() => void runCheck()}
            >
              Retry check
            </button>
          </div>
        ) : null}

        {check.status === "result" ? (
          <div
            className={`rounded-2xl border px-4 py-4 text-sm font-medium transition ${
              check.available
                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                : "border-amber-300/40 bg-amber-400/10 text-amber-100"
            }`}
          >
            <p className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${check.available ? "bg-emerald-300" : "bg-amber-300"}`}
              />
              <span className="font-semibold">
                {resultTitle}
              </span>
            </p>
            <p className="mt-1 text-[13px] text-white/80">{check.message}</p>
            {check.demandTotal ? (
              <p className="mt-2 text-[12px] text-white/65">
                ~{check.demandTotal} buyers / sellers / movers in the next 60 days
              </p>
            ) : null}
            {check.totalClaimed > 0 ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
                {check.totalClaimed} territories claimed nationwide
              </p>
            ) : null}
            <a
              href={signupHref}
              className="mt-3 inline-flex rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#09081b] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              {check.available ? "Request this ZIP →" : "Check a nearby ZIP →"}
            </a>
          </div>
        ) : null}
      </div>

      {showForm && submit.status !== "done" ? (
        <form onSubmit={submitReservation} className="mt-6 grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-white">
            {claimed ? "Join the waitlist for this territory" : `Request ZIP ${check.zip}`}
          </p>

          <Field
            label="Full name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            autoComplete="name"
            required
          />
          <Field
            label="Work email"
            type="email"
            value={form.workEmail}
            onChange={(v) => setForm((f) => ({ ...f, workEmail: v }))}
            autoComplete="email"
            required
          />
          <Field
            label="Company / brokerage"
            value={form.company}
            onChange={(v) => setForm((f) => ({ ...f, company: v }))}
            autoComplete="organization"
            required
          />
          <Field
            label="Mobile phone"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            autoComplete="tel"
          />

          <label className="text-xs font-medium text-white/70">
            Team size
            <select
              value={form.monthlyLeadVolume}
              onChange={(e) => setForm((f) => ({ ...f, monthlyLeadVolume: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
            >
              {VOLUME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-white/70">
            Role
            <input
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-white/70">
            Anything we should know? (optional)
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          {submit.status === "error" ? (
            <p className="sm:col-span-2 text-sm font-medium text-rose-200">{submit.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={submit.status === "submitting"}
            className="sm:col-span-2 mt-1 rounded-2xl bg-amber-400 px-6 py-3 text-base font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          >
            {submit.status === "submitting"
              ? "Submitting…"
              : claimed
                ? "Join the waitlist"
                : "Request this territory"}
          </button>
          <p className="sm:col-span-2 text-[11px] text-white/50">
            Prefer the full signup?{" "}
            <a href={signupHref} className="underline hover:text-white">
              Continue on ypnus.com
            </a>
            . No credit card required.
          </p>
        </form>
      ) : null}

      {submit.status === "done" ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-5 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
            {claimed ? "Waitlist request received" : "Territory request received"}
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-100">{submit.message}</p>
          <a
            href={signupHref}
            className="mt-4 inline-flex rounded-full bg-amber-400 px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#09081b] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Finish free setup →
          </a>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-medium text-white/70">
      {label}
      {required ? <span className="text-violet-300"> *</span> : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
      />
    </label>
  );
}
