import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ypnus.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/embed/intake`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/analytics`, lastModified: now, changeFrequency: "weekly", priority: 0.3 },
  ];
}
