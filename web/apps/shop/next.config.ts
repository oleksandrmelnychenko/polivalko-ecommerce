import path from "node:path";
import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:5080";
const workspaceRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  transpilePackages: ["@polivalko/shared"],
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return ["/order/:number", "/account/confirm-email", "/account/reset-password", "/pay/sandbox/:id"].map((source) => ({
      source,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }));
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }],
      fallback: [],
    };
  },
  async redirects() {
    return [
      { source: "/koshyk", destination: "/cart", permanent: true },
      { source: "/product-category/:slug", destination: "/catalog/:slug", permanent: true },
      { source: "/info/dostavka-i-oplata", destination: "/payment-delivery", permanent: true },
      { source: "/info/dostavka", destination: "/payment-delivery", permanent: true },
      { source: "/info/oplata", destination: "/payment-delivery", permanent: true },
      { source: "/info/obmin-ta-povernennia", destination: "/returns", permanent: true },
      { source: "/info/obmin-ta-povernennya", destination: "/returns", permanent: true },
      { source: "/info/publichna-oferta", destination: "/offer", permanent: true },
      { source: "/info/polityka-konfidentsiinosti", destination: "/privacy", permanent: true },
      { source: "/info/polityka-konfidentsiynosti", destination: "/privacy", permanent: true },
    ];
  },
};

export default nextConfig;
