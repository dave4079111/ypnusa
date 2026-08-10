"use client";

import { useState } from "react";
import type { FormEvent } from "react";

interface Snapshot {
  estimatedHomeValueUsd: number;
  currentMortgageBalanceUsd: number;
  estimatedEquityUsd: number;
  illustrativeCashOutUsd: number;
  estimatedLtvPct: number;
}

interface EquityResponse {
  ok: boolean;
  snapshot?: Snapshot;
  saved?: boolean;
  error?: string;
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function EquitySnapshot() {
  const [zip, setZip] = useState("");
  const [homeValue, setHomeValue] = useState("500000");
  const [mortgageBalance, setMortgageBalance] = useState("275000");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [reviewState, setReviewState] = useState<"idle" | "saving" | "saved">("idle");
  const [reviewError, setReviewError] = useState("");

  const requestBody = {
    zip,
    estimatedHomeValueUsd: Number(homeValue),
    currentMortgageBalanceUsd: Number(mortgageBalance),
  };

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstimating(true);
    setEstimateError("");
    setReviewState("idle");
    setReviewError("");

    try {
      const response = await fetch("/api/property/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await response.json()) as EquityResponse;
      if (!response.ok || !data.ok || !data.snapshot) {
        throw new Error(data.error ?? "The estimate could not be calculated.");
      }
      setSnapshot(data.snapshot);
    } catch (error) {
      setSnapshot(null);
      setEstimateError(error instanceof Error ? error.message : "The estimate could not be calculated.");
    } finally {
      setEstimating(false);
    }
  }

  async function requestReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !consent) {
      setReviewError("Please confirm permission for an MLO to contact you.");
      return;
    }

    setReviewState("saving");
    setReviewError("");
    try {
      const response = await fetch("/api/property/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestBody,
          name,
          email,
          phone,
          contactConsent: true,
          source: "equity_snapshot_tool",
        }),
      });
      const data = (await response.json()) as EquityResponse;
      if (!response.ok || !data.ok || !data.saved) {
        throw new Error(data.error ?? "Your review request could not be saved.");
      }
      setReviewState("saved");
    } catch (error) {
      setReviewState("idle");
      setReviewError(
        error instanceof Error ? error.message : "Your review request could not be saved.",
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form
        onSubmit={calculate}
        className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 sm:p-7"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Your estimates
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Run an equity snapshot</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            We do not pull a credit report or appraisal. Enter values you already know.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-white/80">
            Property ZIP
            <input
              value={zip}
              onChange={(event) => setZip(event.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="93618"
              required
              pattern="\d{5}"
              className="h-12 rounded-xl border border-white/10 bg-black/20 px-4 text-base text-white outline-none placeholder:text-white/25 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-white/80">
            Estimated home value
            <span className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                $
              </span>
              <input
                value={homeValue}
                onChange={(event) => setHomeValue(event.target.value)}
                type="number"
                inputMode="numeric"
                min={10000}
                max={10000000}
                step={1000}
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-8 pr-4 text-base text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              />
            </span>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-white/80">
            Current mortgage balance
            <span className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                $
              </span>
              <input
                value={mortgageBalance}
                onChange={(event) => setMortgageBalance(event.target.value)}
                type="number"
                inputMode="numeric"
                min={0}
                max={20000000}
                step={1000}
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-8 pr-4 text-base text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              />
            </span>
          </label>
        </div>

        {estimateError ? (
          <p className="mt-4 rounded-xl bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {estimateError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={estimating}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-bold text-[#09081b] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
        >
          {estimating ? "Calculating…" : "Calculate my snapshot"}
        </button>
      </form>

      <section
        className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/30 to-white/[0.06] p-5 sm:p-7"
        aria-live="polite"
      >
        {!snapshot ? (
          <div className="flex min-h-[30rem] flex-col items-center justify-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl" aria-hidden>
              ⌂
            </span>
            <h2 className="mt-5 text-2xl font-semibold">Your estimate appears here</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">
              See estimated equity, loan-to-value, and an illustrative cash-out ceiling without
              sharing contact details.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
              Illustrative snapshot
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/45">Estimated equity</p>
                <p className={`mt-2 text-2xl font-semibold ${snapshot.estimatedEquityUsd < 0 ? "text-rose-300" : "text-white"}`}>
                  {usd(snapshot.estimatedEquityUsd)}
                </p>
              </article>
              <article className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/45">Estimated LTV</p>
                <p className="mt-2 text-2xl font-semibold">{snapshot.estimatedLtvPct}%</p>
              </article>
              <article className="rounded-2xl bg-amber-400 p-4 text-[#09081b] sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/55">
                  Illustrative cash-out at 80% LTV
                </p>
                <p className="mt-2 text-3xl font-black">{usd(snapshot.illustrativeCashOutUsd)}</p>
              </article>
            </div>

            <p className="mt-4 text-xs leading-5 text-white/45">
              Based only on values you entered. This is not an appraisal, credit decision,
              commitment to lend, or offer of loan terms. Actual limits vary by program,
              occupancy, credit, property, and lender requirements.
            </p>

            {reviewState === "saved" ? (
              <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                <p className="font-semibold text-emerald-200">Review request received</p>
                <p className="mt-1 text-sm text-white/60">
                  A YPN USA loan officer can now follow up about the numbers you entered.
                </p>
              </div>
            ) : (
              <form onSubmit={requestReview} className="mt-6 border-t border-white/10 pt-6">
                <h3 className="text-lg font-semibold">Ask an MLO to review the estimate</h3>
                <p className="mt-1 text-sm text-white/50">
                  Optional. Your anonymous calculation is already complete.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400"
                  />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    type="email"
                    autoComplete="email"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400"
                  />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Mobile phone (optional)"
                    type="tel"
                    autoComplete="tel"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400 sm:col-span-2"
                  />
                </div>
                <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-white/55">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    required
                    className="mt-1 accent-violet-500"
                  />
                  YPN USA and an assigned loan officer may contact me by email and, if provided,
                  text or phone about this request. Message and data rates may apply; reply STOP
                  to opt out.
                </label>
                {reviewError ? (
                  <p className="mt-3 text-sm text-rose-200" role="alert">
                    {reviewError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={reviewState === "saving"}
                  className="mt-4 h-11 w-full rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
                >
                  {reviewState === "saving" ? "Saving…" : "Request an MLO review"}
                </button>
              </form>
            )}

            <a
              href="https://toinvested.com/property-analyzer/?utm_source=ypnus&utm_medium=app&utm_campaign=equity_snapshot"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex text-sm font-semibold text-violet-200 hover:text-white"
            >
              Analyzing a rental? Run full DSCR underwriting on ToInvested →
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
