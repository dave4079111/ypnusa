import type { NextConfig } from "next";

const publicAssetCache = "public, max-age=86400, stale-while-revalidate=604800";
const embedOrigins = (process.env.EMBED_ALLOWED_ORIGINS ?? "https://ypnus.com")
  .split(",")
  .flatMap((candidate) => {
    try {
      const url = new URL(candidate.trim());
      return url.protocol === "https:" ? [url.origin] : [];
    } catch {
      return [];
    }
  });
const frameAncestors = ["'self'", ...new Set(embedOrigins)].join(" ");
const resourcePolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "Content-Security-Policy",
    value:
      `${resourcePolicy}; frame-ancestors 'self'; form-action 'self' https://ypnus.com`,
  },
];

const nextConfig: NextConfig = {
  // Smaller Hostinger / Node host deploys; `next start` still works.
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": [
      "./next.config.ts",
      "./docs/**/*",
      "./hostinger/**/*",
      "./scripts/**/*",
      "./wp-plugins/**/*",
      "./data/**/*",
    ],
  },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `${resourcePolicy}; frame-ancestors ${frameAncestors}; form-action 'self' https://ypnus.com`,
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: publicAssetCache,
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: publicAssetCache,
          },
        ],
      },
      {
        source: "/:path*.(avif|webp|png|jpg|jpeg|gif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: publicAssetCache,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
