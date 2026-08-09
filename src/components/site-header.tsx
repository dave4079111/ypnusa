import Link from "next/link";
import { marketingUrl } from "@/lib/site";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#territories", label: "Territories" },
  { href: "#ownership", label: "You own it" },
  { href: "#demo", label: "Live demo" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09081b]/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
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
          <a
            href={marketingUrl("/")}
            className="hidden rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/30 hover:text-white sm:inline"
          >
            ← ypnus.com
          </a>
        </div>

        <nav className="hidden items-center gap-7 text-sm font-medium text-white/75 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </a>
          ))}
          <a href={marketingUrl("/")} className="transition hover:text-white">
            Homepage
          </a>
        </nav>

        <a
          href="#territories"
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/20 transition hover:brightness-105"
        >
          Claim your ZIP
        </a>
      </div>
    </header>
  );
}
