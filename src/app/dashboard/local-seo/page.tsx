import type { Metadata } from "next";
import Link from "next/link";
import { GbpLinkingWidget } from "@/components/local-seo/gbp-linking-widget";
import type { PublicBusinessProfile } from "@/lib/local-seo";
import { requireMloSession } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Local SEO & Google Business Profile",
  description: "Configure YPN USA local territory pages and verified Google review connections.",
  robots: { index: false, follow: false },
};

export default async function LocalSeoDashboardPage() {
  const session = await requireMloSession();
  const business: PublicBusinessProfile = {
    name: session.profile.name,
    email: session.profile.email,
    nmlsId: session.profile.nmlsId,
  };

  return (
    <main className="min-h-full bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header>
          <Link href="/analytics" className="text-sm font-semibold text-violet-700">
            ← MLO dashboard
          </Link>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">
            MLO local visibility
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Local SEO control center</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Review the public NAP, local page registry, review-link readiness, and verified review
            provider status before publishing a co-branded territory.
          </p>
        </header>

        <div className="mt-10">
          <GbpLinkingWidget business={business} />
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Production checklist</h2>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
            <li className="rounded-2xl bg-slate-50 p-4">
              1. Confirm the public business name, phone, address policy, NMLS ID, and service area.
            </li>
            <li className="rounded-2xl bg-slate-50 p-4">
              2. Add the verified Place ID and public profile URL; restrict any Maps browser key.
            </li>
            <li className="rounded-2xl bg-slate-50 p-4">
              3. Connect a lawful review provider that returns source-backed review records.
            </li>
            <li className="rounded-2xl bg-slate-50 p-4">
              4. Route closing events to the review-request endpoint and configure the delivery
              webhook.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
