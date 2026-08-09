import Link from "next/link";
import {
  LOCAL_SEO_PROFILES,
  buildGoogleReviewUrl,
  getLocalSeoPath,
  type PublicBusinessProfile,
} from "@/lib/local-seo";

function StatusRow({
  configured,
  label,
  detail,
}: {
  configured: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start justify-between gap-5 rounded-2xl border border-slate-200 px-4 py-3">
      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
        }`}
      >
        {configured ? "Connected" : "Setup needed"}
      </span>
    </li>
  );
}

export function GbpLinkingWidget({ business }: { business: PublicBusinessProfile }) {
  const reviewUrl = buildGoogleReviewUrl(business.placeId);
  const hasNapAddress = Boolean(
    business.streetAddress && business.locality && business.region && business.postalCode,
  );
  const hasReviewProvider = Boolean(
    process.env.GBP_REVIEWS_PROVIDER_URL || process.env.GBP_VERIFIED_REVIEWS_JSON,
  );

  return (
    <section className="rounded-3xl bg-white p-6 shadow-xl shadow-violet-100/70 ring-1 ring-slate-200">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
            Google Business Profile
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Local presence connection</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            YPN USA reads only explicitly configured public profile data. This dashboard does not
            claim direct access to Google Business Profile management APIs.
          </p>
        </div>
        <a
          href="https://business.google.com/"
          className="inline-flex shrink-0 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
          rel="noreferrer"
          target="_blank"
        >
          Open Google Business Profile ↗
        </a>
      </div>

      <ul className="mt-7 grid gap-3 md:grid-cols-2">
        <StatusRow
          configured={Boolean(business.placeId)}
          label="Google Place ID"
          detail="Required to generate the direct post-closing Google review link."
        />
        <StatusRow
          configured={Boolean(business.profileUrl)}
          label="Public profile URL"
          detail="Shown on local territory pages as the verified business listing."
        />
        <StatusRow
          configured={hasNapAddress}
          label="NAP address"
          detail="Name and contact defaults exist; add a public address only if customers can visit it."
        />
        <StatusRow
          configured={hasReviewProvider}
          label="Verified review feed"
          detail="Connect a server-side provider or validated configuration before reviews are displayed."
        />
      </ul>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-violet-50 p-5">
          <h3 className="font-semibold text-violet-950">Post-closing review automation</h3>
          {reviewUrl ? (
            <>
              <p className="mt-2 text-sm leading-6 text-violet-900/70">
                The direct Google review destination is ready for the closing-event webhook.
              </p>
              <a
                href={reviewUrl}
                className="mt-4 inline-flex text-sm font-semibold text-violet-800"
                rel="noreferrer"
                target="_blank"
              >
                Test review destination ↗
              </a>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-violet-900/70">
              Add <code>GBP_PLACE_ID</code> before enabling review requests. No generic or
              unverified review destination is substituted.
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-slate-50 p-5">
          <h3 className="font-semibold text-slate-950">Published local silos</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCAL_SEO_PROFILES.map((profile) => (
              <Link
                key={`${profile.kind}-${profile.slug}`}
                href={getLocalSeoPath(profile)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {profile.kind === "city" ? profile.city : profile.slug}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
