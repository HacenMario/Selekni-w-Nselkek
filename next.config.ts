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
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || "3100"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
