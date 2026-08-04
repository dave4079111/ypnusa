"use client";

import { useMemo, useState } from "react";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );

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
    <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl md:grid-cols-2 md:p-10">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="calc-amount" className="text-sm font-semibold text-slate-700">
              Loan amount
            </label>
            <span className="text-lg font-bold text-violet-700">{usd(amount)}</span>
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
            onChange={(e) => setRate(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-violet-500"
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
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-violet-500"
          >
            {TERMS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-8 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">Estimated monthly payment</p>
        <p className="mt-2 text-5xl font-black">{usd(monthly)}</p>
        <p className="mt-3 text-sm text-violet-100">
          Principal &amp; interest · {term}-year term
        </p>
        <div className="mt-6 border-t border-white/20 pt-4 text-sm text-violet-100">
          <div className="flex justify-between">
            <span>Total interest</span>
            <span className="font-semibold text-white">{usd(totalInterest)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Total of payments</span>
            <span className="font-semibold text-white">{usd(monthly * term * 12)}</span>
          </div>
        </div>
        <a
          href="#territories"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/30 transition hover:brightness-105"
        >
          Put this tool on my MLO site
        </a>
      </div>
    </div>
  );
}
