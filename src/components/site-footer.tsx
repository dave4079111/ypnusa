import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#09081b] text-white/70">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-black text-white">
              Y
            </span>
            <span className="text-sm font-semibold text-white">
              YPN<span className="text-violet-300"> USA</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm">
            Exclusive ZIP demand for mortgage loan officers. Own your leads, own your website, and let an
            always-on AI agent turn your territory into a pipeline — no waiting on Realtors.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Product</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a href="#how" className="transition hover:text-white">How it works</a></li>
            <li><a href="#territories" className="transition hover:text-white">Territories</a></li>
            <li><a href="#demo" className="transition hover:text-white">Live demo</a></li>
            <li><a href="#pricing" className="transition hover:text-white">Pricing</a></li>
            <li><Link href="/analytics" className="transition hover:text-white">Analytics</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Get started</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a href="#territories" className="transition hover:text-white">Check ZIP availability</a></li>
            <li><a href="#pricing" className="transition hover:text-white">Start free</a></li>
            <li><Link href="/embed/intake" className="transition hover:text-white">Embed the assistant</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} YPN USA. All rights reserved.</p>
          <p>Founded by David J. Moore, MBA · You own your leads and your site.</p>
        </div>
      </div>
    </footer>
  );
}
