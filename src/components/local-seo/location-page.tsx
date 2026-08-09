import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  LOCAL_SEO_PROFILES,
  LOCAL_SEO_PUBLIC_ORIGIN,
  buildGoogleReviewUrl,
  getLocalSeoPath,
  loadGbpReviews,
  serializeJsonLd,
  type LocalSeoProfile,
  type PublicBusinessProfile,
  type ReviewFeed,
} from "@/lib/local-seo";

interface LocationPageProps {
  profile: LocalSeoProfile;
  business: PublicBusinessProfile;
}

function LocalMetrics({ metrics }: Pick<LocalSeoProfile, "metrics">) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            {metric.label}
          </p>
          {metric.value && metric.asOf ? (
            <>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">Source period: {metric.asOf}</p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No dated value is published here until a source-backed metric is configured.
            </p>
          )}
          <a
            href={metric.sourceUrl}
            className="mt-4 inline-flex text-sm font-semibold text-violet-700 hover:text-violet-900"
            rel="noreferrer"
            target="_blank"
          >
            Check {metric.sourceName} ↗
          </a>
        </article>
      ))}
    </div>
  );
}

function ServiceAreaMap({ profile }: { profile: LocalSeoProfile }) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim();
  const search = `${profile.city}, ${profile.stateCode} ${profile.zipCodes.join(" ")}`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {mapsKey ? (
        <iframe
          title={`Map of the ${profile.city}, ${profile.stateCode} service area`}
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(search)}`}
          className="h-72 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-amber-50 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
            {profile.city} service area
          </p>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            The embedded map is disabled until a restricted Google Maps Embed key is configured.
            Location links remain available without tracking the visitor.
          </p>
          <a
            href={mapLink}
            className="mt-5 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
            rel="noreferrer"
            target="_blank"
          >
            Open {profile.city} in Google Maps ↗
          </a>
        </div>
      )}
    </section>
  );
}

function NapCard({
  business,
  profile,
}: {
  business: PublicBusinessProfile;
  profile: LocalSeoProfile;
}) {
  const addressParts = [
    business.streetAddress,
    business.locality,
    business.region,
    business.postalCode,
  ].filter(Boolean);

  return (
    <aside className="rounded-3xl bg-[#100d2c] p-7 text-white shadow-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
        Local territory contact
      </p>
      <h2 className="mt-3 text-2xl font-semibold">{business.name}</h2>
      <dl className="mt-5 space-y-3 text-sm text-white/80">
        <div>
          <dt className="font-semibold text-white">Service area</dt>
          <dd>
            {profile.city}, {profile.stateCode} · {profile.county}
          </dd>
        </div>
        {business.phone ? (
          <div>
            <dt className="font-semibold text-white">Phone</dt>
            <dd>
              <a href={`tel:${business.phone}`} className="hover:text-white">
                {business.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {business.email ? (
          <div>
            <dt className="font-semibold text-white">Email</dt>
            <dd>
              <a href={`mailto:${business.email}`} className="hover:text-white">
                {business.email}
              </a>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-white">Office address</dt>
          <dd>
            {addressParts.length > 0
              ? addressParts.join(", ")
              : "Service-area business; a public office address is not configured."}
          </dd>
        </div>
        {business.nmlsId ? (
          <div>
            <dt className="font-semibold text-white">NMLS ID</dt>
            <dd>{business.nmlsId}</dd>
          </div>
        ) : null}
      </dl>
      {business.profileUrl ? (
        <a
          href={business.profileUrl}
          className="mt-6 inline-flex text-sm font-semibold text-amber-300 hover:text-amber-200"
          rel="noreferrer"
          target="_blank"
        >
          View verified Google Business Profile ↗
        </a>
      ) : (
        <p className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-3 text-xs leading-5 text-white/65">
          A verified Google Business Profile link has not been configured.
        </p>
      )}
    </aside>
  );
}

function ReviewSection({
  feed,
  reviewUrl,
}: {
  feed: ReviewFeed;
  reviewUrl?: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
            Google reviews
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">What verified clients say</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{feed.message}</p>
        </div>
        {reviewUrl ? (
          <a
            href={reviewUrl}
            className="inline-flex shrink-0 rounded-full bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white"
            rel="noreferrer"
            target="_blank"
          >
            Leave a Google review ↗
          </a>
        ) : null}
      </div>
      {feed.reviews.length > 0 ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {feed.reviews.map((review) => (
            <blockquote key={review.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <p aria-label={`${review.rating} out of 5 stars`} className="text-amber-500">
                {"★".repeat(review.rating)}
                <span className="text-slate-300">{"★".repeat(5 - review.rating)}</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">“{review.text}”</p>
              <footer className="mt-4 text-xs font-semibold text-slate-950">
                {review.sourceUrl ? (
                  <a href={review.sourceUrl} rel="noreferrer" target="_blank">
                    {review.author} ↗
                  </a>
                ) : (
                  review.author
                )}
                {review.publishedAt ? ` · ${review.publishedAt}` : ""}
              </footer>
            </blockquote>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export async function LocationPage({ profile, business }: LocationPageProps) {
  const reviewFeed = await loadGbpReviews(business);
  const reviewUrl = buildGoogleReviewUrl(business.placeId);
  const canonicalUrl = `${LOCAL_SEO_PUBLIC_ORIGIN}${getLocalSeoPath(profile)}`;
  const hasVerifiedMortgageIdentity = Boolean(
    process.env.MLO_PUBLIC_NAME?.trim() && business.nmlsId,
  );
  const address =
    business.streetAddress && business.locality && business.region
      ? {
          "@type": "PostalAddress",
          streetAddress: business.streetAddress,
          addressLocality: business.locality,
          addressRegion: business.region,
          postalCode: business.postalCode,
          addressCountry: "US",
        }
      : undefined;
  const aggregateRating =
    reviewFeed.reviews.length > 0
      ? {
          "@type": "AggregateRating",
          ratingValue:
            reviewFeed.reviews.reduce((total, review) => total + review.rating, 0) /
            reviewFeed.reviews.length,
          reviewCount: reviewFeed.reviews.length,
        }
      : undefined;
  const jsonLd = hasVerifiedMortgageIdentity
    ? {
        "@context": "https://schema.org",
        "@type": ["FinancialService", "MortgageBroker"],
        "@id": `${canonicalUrl}#business`,
        name: business.name,
        url: canonicalUrl,
        telephone: business.phone,
        email: business.email,
        address,
        areaServed: {
          "@type": "City",
          name: `${profile.city}, ${profile.stateCode}`,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: profile.latitude,
          longitude: profile.longitude,
        },
        sameAs: business.profileUrl ? [business.profileUrl] : undefined,
        aggregateRating,
        review:
          reviewFeed.reviews.length > 0
            ? reviewFeed.reviews.map((review) => ({
                "@type": "Review",
                author: { "@type": "Person", name: review.author },
                reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
                reviewBody: review.text,
              }))
            : undefined,
      }
    : {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: profile.headline,
        url: canonicalUrl,
        about: `${profile.city}, ${profile.stateCode} mortgage information`,
      };
  const relatedProfiles = LOCAL_SEO_PROFILES.filter(
    (candidate) =>
      candidate.slug !== profile.slug &&
      candidate.stateCode === profile.stateCode &&
      (candidate.city === profile.city || candidate.county === profile.county),
  ).slice(0, 3);

  return (
    <div className="min-h-full bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-[#09081b] text-white">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
              {profile.city}, {profile.stateCode} · {profile.county}
            </p>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-tight lg:text-6xl">
              {profile.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/80">
              {profile.introduction}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {profile.neighborhoods.map((neighborhood) => (
                <span
                  key={neighborhood}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80"
                >
                  {neighborhood}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-10">
            <article>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
                Local financing context
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                Start with the property, not an area-wide promise
              </h2>
              <p className="mt-4 leading-8 text-slate-600">{profile.marketContext}</p>
              <p className="mt-4 leading-8 text-slate-600">{profile.localProcess}</p>
            </article>
            <LocalMetrics metrics={profile.metrics} />
            <div className="rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-950 ring-1 ring-amber-200">
              Municipal and housing links are research starting points, not a loan estimate,
              appraisal, tax opinion, or guarantee. Verify the current parcel and program details
              before making a decision.
            </div>
          </div>
          <NapCard business={business} profile={profile} />
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-2">
          <ServiceAreaMap profile={profile} />
          <article className="rounded-3xl border border-slate-200 p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
              Public resources
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Verify local details directly</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use the municipal website for current local services, planning information, and
              official contacts. County records should be checked for parcel-level tax details.
            </p>
            <a
              href={profile.municipalUrl}
              className="mt-5 inline-flex font-semibold text-violet-700 hover:text-violet-900"
              rel="noreferrer"
              target="_blank"
            >
              Visit {profile.municipalName} ↗
            </a>
          </article>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <ReviewSection feed={reviewFeed} reviewUrl={reviewUrl} />
        </section>

        {relatedProfiles.length > 0 ? (
          <section className="border-y border-slate-200 bg-slate-50">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <h2 className="text-2xl font-semibold">Nearby YPN USA service pages</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {relatedProfiles.map((related) => (
                  <Link
                    key={`${related.kind}-${related.slug}`}
                    href={getLocalSeoPath(related)}
                    className="rounded-2xl bg-white p-5 font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:ring-violet-300"
                  >
                    {related.kind === "city"
                      ? `Mortgage broker in ${related.city}, ${related.stateCode}`
                      : `${related.city} mortgage help in ZIP ${related.slug}`}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="bg-[#100d2c] px-6 py-16 text-center text-white">
          <h2 className="text-3xl font-semibold">Talk through your local financing goal</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">
            Share your target ZIP and timeline. Your configured mortgage contact can confirm
            current availability and provide information for your specific scenario.
          </p>
          <a
            href="https://ypnus.com/lo-signup.html"
            className="mt-7 inline-flex rounded-full bg-amber-400 px-7 py-3 font-semibold text-[#09081b]"
          >
            Get local mortgage guidance
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
