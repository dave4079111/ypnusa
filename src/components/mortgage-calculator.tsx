"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/format";

const TERMS = [
  { value: 30, label: "30-year fixed" },
  { value: 15, label: "15-year fixed" },
  { value: 10, label: "10-year fixed" },
];

export function MortgageCalculator() {
  const [amount, setAmount] = useState(450000);
  const [rate, setRate] = useState(6.7);
  const [term, setTerm] = useState(30);

  const { monthly, totalInterest } = useMemo(() => {
    const p = amount;
    const r = rate / 100 / 12;
    const n = term * 12;
    if (r === 0) return { monthly: p / n, totalInterest: 0 };
    const m = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return { monthly: m, totalInterest: m * n - p };
  }, [amount, rate, term]);

  return (
    <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8 md:grid-cols-2 md:p-10">
      <div className="space-y-6">
        <div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="calc-amount" className="text-sm font-semibold text-slate-700">
              Loan amount
            </label>
            <span className="text-lg font-bold text-violet-700">{formatUsd(amount)}</span>
          </div>
          <input
            id="calc-amount"
            type="range"
            min={100000}
            max={2000000}
            step={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-3 w-full accent-violet-600"
          />
        </div>

        <div>
          <label htmlFor="calc-rate" className="block text-sm font-semibold text-slate-700">
            Interest rate (%)
          </label>
          <input
            id="calc-rate"
            type="number"
            step={0.01}
            min={0}
            max={25}
            value={rate}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (e.target.value === "" || !Number.isFinite(next)) return;
              setRate(Math.min(25, Math.max(0, next)));
            }}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label htmlFor="calc-term" className="block text-sm font-semibold text-slate-700">
            Loan product
          </label>
          <select
            id="calc-term"
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:ring-2 focus:ring-violet-500"
          >
            {TERMS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex min-h-[320px] flex-col justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-6 text-center text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">Estimated monthly payment</p>
        <p className="mt-2 text-4xl font-black sm:text-5xl">{formatUsd(monthly)}</p>
        <p className="mt-3 text-sm text-violet-100">
          Principal &amp; interest · {term}-year term
        </p>
        <div className="mt-6 border-t border-white/20 pt-4 text-sm text-violet-100">
          <div className="flex justify-between">
            <span>Total interest</span>
            <span className="font-semibold text-white">{formatUsd(totalInterest)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Total of payments</span>
            <span className="font-semibold text-white">{formatUsd(monthly * term * 12)}</span>
          </div>
        </div>
        <a
          href="#territories"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          Put this tool on my MLO site
        </a>
        <Link
          href="/tools/equity"
          className="mt-3 inline-flex items-center justify-center text-sm font-semibold text-violet-100 underline decoration-white/30 underline-offset-4 hover:text-white"
        >
          Estimate equity in a current home →
        </Link>
      </div>
    </div>
  );
}
