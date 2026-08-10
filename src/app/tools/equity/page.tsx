import type { Metadata } from "next";
import Link from "next/link";
import { EquitySnapshot } from "@/components/equity-snapshot";

export const metadata: Metadata = {
  title: "Home Equity Snapshot",
  description:
    "Estimate home equity, loan-to-value, and an illustrative cash-out ceiling using values you provide.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function EquitySnapshotPage() {
  return (
    <main className="min-h-screen bg-[#09081b] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-black">
              Y
            </span>
            YPN <span className="-ml-1 text-violet-300">USA</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
          >
            Back to home
          </Link>
        </nav>

        <header className="mx-auto max-w-3xl py-12 text-center sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
            Free borrower tool
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            See what your estimated home equity could unlock.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">
            Run a private first-pass snapshot with no signup. If you want help interpreting it,
            you can optionally ask a licensed loan officer to review the values you entered.
          </p>
        </header>

        <EquitySnapshot />

        <footer className="mt-10 border-t border-white/10 py-8 text-center text-xs leading-5 text-white/35">
          Educational estimate only. YPN USA does not perform an appraisal, determine eligibility,
          or promise proceeds through this calculator.
        </footer>
      </div>
    </main>
  );
}
