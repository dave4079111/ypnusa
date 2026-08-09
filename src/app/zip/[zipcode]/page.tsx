import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationPage } from "@/components/local-seo/location-page";
import {
  LOCAL_SEO_PROFILES,
  LOCAL_SEO_PUBLIC_ORIGIN,
  getLocalSeoPath,
  getLocalSeoProfile,
  getPublicBusinessProfile,
} from "@/lib/local-seo";

type Props = {
  params: Promise<{ zipcode: string }>;
};

export function generateStaticParams() {
  return LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "zip").map((profile) => ({
    zipcode: profile.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zipcode } = await params;
  const profile = getLocalSeoProfile("zip", zipcode);
  if (!profile) notFound();

  const path = getLocalSeoPath(profile);
  const title = `Mortgage Help in ${profile.city}, ${profile.stateCode} ${profile.slug}`;
  const description = `${profile.introduction} Review public local resources and connect with the configured mortgage professional for ZIP ${profile.slug}.`;

  return {
    title,
    description,
    keywords: [
      `mortgage broker ${profile.slug}`,
      `${profile.city} ${profile.slug} home loans`,
      `mortgage professional ${profile.county}`,
      ...profile.neighborhoods.map((neighborhood) => `${neighborhood} home financing`),
    ],
    alternates: { canonical: `${LOCAL_SEO_PUBLIC_ORIGIN}${path}` },
    openGraph: {
      type: "website",
      url: `${LOCAL_SEO_PUBLIC_ORIGIN}${path}`,
      title,
      description,
      siteName: "YPN USA",
    },
    robots: { index: true, follow: true },
  };
}

export default async function ZipMortgagePage({ params }: Props) {
  const { zipcode } = await params;
  const profile = getLocalSeoProfile("zip", zipcode);
  if (!profile) notFound();

  return <LocationPage profile={profile} business={getPublicBusinessProfile()} />;
}
