import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Docker image; Vercel manages its own output.
  output: process.env["VERCEL"] ? undefined : "standalone",
  // Cache Components / PPR are intentionally off in Phase 1: the dashboard is
  // per-request and authenticated, and PPR is incompatible with the nonce-based
  // CSP issued in src/proxy.ts (see docs/architecture.md).
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
      // Add reverse-proxy hostnames here if the public host differs from the request host.
      allowedOrigins: [],
    },
  },
};

export default nextConfig;
