import Link from "next/link";

const MARKETING = "https://ypnus.com";

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
              <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-white/45">
                App
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm">
            Product app for exclusive ZIP demand. Marketing site and content live on{" "}
            <a href={MARKETING} className="underline hover:text-white">
              ypnus.com
            </a>
            ; this surface is{" "}
            <a href="https://app.ypnus.com" className="underline hover:text-white">
              app.ypnus.com
            </a>
            .
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">ypnus.com</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a href={`${MARKETING}/check-zip.html`} className="transition hover:text-white">ZIP demand check</a></li>
            <li><a href={`${MARKETING}/lo-signup.html`} className="transition hover:text-white">Free LO signup</a></li>
            <li><a href={`${MARKETING}/pricing-plans/`} className="transition hover:text-white">Pricing plans</a></li>
            <li><Link href="/embed/intake" className="transition hover:text-white">Embed the assistant</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-white/50 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} YPN Inc. / YPN USA. All rights reserved.</p>
          <p>
            David J. Moore, MBA · NMLS #787257 · DRE #01852847 · Equal Housing Opportunity · Marketing
            technology only — not a commitment to lend.
          </p>
        </div>
      </div>
    </footer>
  );
}
