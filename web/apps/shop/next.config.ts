import path from "node:path";
import { apiInternalUrl } from "@polivalko/shared/api/origin";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");
const storefrontAreas = [
  "account", "bestsellers", "cart", "catalog", "categories", "checkout", "collections", "contacts",
  "customer-mail", "delivery", "orders", "pages", "payments", "products", "redirects", "seller",
  "service-directions", "service-requests", "site",
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  transpilePackages: ["@polivalko/shared"],
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return ["/order/:number", "/account/:path*", "/pay/sandbox/:id"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store" },
      ],
    }));
  },
  async rewrites() {
    return [
      {
        source: `/api/v1/:area(${storefrontAreas.join("|")})/:path*`,
        destination: `${apiInternalUrl}/api/v1/:area/:path*`,
      },
      { source: "/api/media/:path*", destination: `${apiInternalUrl}/api/media/:path*` },
    ];
  },
};

export default nextConfig;
