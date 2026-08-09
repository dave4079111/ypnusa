import {
  LOCAL_SEO_PROFILES,
  LOCAL_SEO_PUBLIC_ORIGIN,
  getLocalSeoPath,
} from "@/lib/local-seo";

export const dynamic = "force-static";

export function GET() {
  const urls = LOCAL_SEO_PROFILES.map(
    (profile) =>
      `<url><loc>${LOCAL_SEO_PUBLIC_ORIGIN}${getLocalSeoPath(profile)}</loc><changefreq>monthly</changefreq><priority>${profile.kind === "city" ? "0.8" : "0.7"}</priority></url>`,
  ).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
