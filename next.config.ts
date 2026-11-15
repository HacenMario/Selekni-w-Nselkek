import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /* Local dev fallback: when NEXT_PUBLIC_API_URL is empty, /api/* would hit
     Next.js itself and 404 (the sandbox gateway that normally proxies them
     does not exist on your machine). Rewrite them to the local API server. */
  async rewrites() {
    // v4.13 — ONLY for local dev / sandbox (client built without an absolute
    // API URL). In production the browser talks to the API server directly and
    // this rewrite must not exist: it sent Vercel's edge to localhost for the
    // Google OAuth callback, which dies with 404 DNS_HOSTNAME_RESOLVED_PRIVATE.
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || "3100"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
