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
  // Catalog photos from Vercel Blob are resized here (src/shared/lib/images.ts). Few widths and one format keep
  // the number of optimized variants, which hosting plans count, small; a Blob URL never changes its content.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/catalog/**" }],
    imageSizes: [64, 128, 256, 384],
    deviceSizes: [640, 828, 1080, 1600],
    qualities: [75],
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
  },
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
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: `/api/v1/:area(${storefrontAreas.join("|")})/:path*`,
          destination: `${apiInternalUrl}/api/v1/:area/:path*`,
        },
        { source: "/api/media/:path*", destination: `${apiInternalUrl}/api/media/:path*` },
      ],
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
