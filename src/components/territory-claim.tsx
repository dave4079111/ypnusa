"use client";

import { useState } from "react";

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

const MARKETING_SIGNUP = "https://ypnus.com/lo-signup.html";

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
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          zip: check.status === "result" ? check.zip : zip,
          source,
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
      ? check.signupUrl || `${MARKETING_SIGNUP}?zip=${encodeURIComponent(check.zip)}`
      : MARKETING_SIGNUP;

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
          className="w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none ring-violet-300 placeholder:font-normal placeholder:text-slate-400 focus:ring-2"
        />
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={check.status === "checking"}
          className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {check.status === "checking" ? "Checking…" : "Check availability"}
        </button>
      </div>

      <div aria-live="polite" role="status">
        {check.status === "error" ? (
          <p className="mt-3 text-sm font-medium text-rose-200">{check.message}</p>
        ) : null}

        {check.status === "result" ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
              check.available
                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                : "border-amber-300/40 bg-amber-400/10 text-amber-100"
            }`}
          >
            <p className="flex items-center gap-2">
              <span aria-hidden>{check.available ? "✅" : "🔒"}</span>
              <span className="font-semibold">
                {check.available ? `${place} is available` : `${place} is already claimed`}
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
              className="mt-3 inline-flex rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#09081b] transition hover:brightness-105"
            >
              {check.available ? "Claim this ZIP free →" : "Start free on a nearby ZIP →"}
            </a>
          </div>
        ) : null}
      </div>

      {showForm && submit.status !== "done" ? (
        <form onSubmit={submitReservation} className="mt-6 grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-white">
            {claimed ? "Join the waitlist for this territory" : `Reserve ZIP ${check.zip}`}
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
            className="sm:col-span-2 mt-1 rounded-2xl bg-amber-400 px-6 py-3 text-base font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:brightness-105 disabled:opacity-60"
          >
            {submit.status === "submitting"
              ? "Submitting…"
              : claimed
                ? "Join the waitlist"
                : "Reserve my territory"}
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
          <p className="text-2xl" aria-hidden>
            🎉
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-100">{submit.message}</p>
          <a
            href={signupHref}
            className="mt-4 inline-flex rounded-full bg-amber-400 px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#09081b]"
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
