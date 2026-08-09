import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller Hostinger / Node host deploys; `next start` still works.
  output: "standalone",
};

export default nextConfig;
