"use client";

import Link from "next/link";
import { useState } from "react";
import { marketingUrl } from "@/lib/site";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#territories", label: "Territories" },
  { href: "#ownership", label: "You own it" },
  { href: "#demo", label: "Live demo" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const signupHref = marketingUrl("/lo-signup.html?plan=free");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09081b]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-black text-white">
            Y
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            YPN<span className="text-violet-300"> USA</span>
            <span className="ml-2 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45 sm:inline">
              App
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-white/75 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
              {item.label}
            </a>
          ))}
          <a href={marketingUrl("/")} className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
            Marketing site
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={signupHref}
            className="hidden rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:inline-flex"
          >
            Claim your ZIP
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 md:hidden"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="relative h-4 w-5">
              <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-white transition ${mobileOpen ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-white transition ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-white transition ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      <div
        id="mobile-navigation"
        className={`md:hidden ${mobileOpen ? "block" : "hidden"}`}
      >
        <nav className="mx-4 mb-4 rounded-3xl border border-white/10 bg-[#120f2a]/95 p-4 shadow-2xl shadow-black/30">
          <div className="grid gap-1 text-sm font-medium text-white/80">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-2xl px-4 py-3 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a
              href={marketingUrl("/")}
              className="rounded-2xl px-4 py-3 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              onClick={() => setMobileOpen(false)}
            >
              Marketing site
            </a>
          </div>
          <a
            href={signupHref}
            className="mt-3 flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            onClick={() => setMobileOpen(false)}
          >
            Start free on ypnus.com
          </a>
        </nav>
      </div>
    </header>
  );
}
