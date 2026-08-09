import type { MetadataRoute } from "next";
import { APP_SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep product/telemetry surfaces out of the marketing crawl budget.
      disallow: ["/api/", "/analytics", "/embed/"],
    },
    sitemap: `${APP_SITE_URL}/sitemap.xml`,
    host: APP_SITE_URL,
  };
}
