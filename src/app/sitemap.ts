import type { MetadataRoute } from "next";
import { APP_SITE_URL } from "@/lib/site";

/**
 * Intentionally small sitemap for the product app.
 * Do NOT regenerate tens of thousands of city/ZIP URLs here — that pattern on
 * app.ypnus.com is already flooding Google's "Not indexed" queue.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
  ];
}
