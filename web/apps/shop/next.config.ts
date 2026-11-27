import path from "node:path";
import { apiInternalUrl } from "@polivalko/shared/api/origin";
import type { NextConfig } from "next";
import { CATALOG_PHOTO_HOST } from "./src/shared/lib/catalog-photo-host";
import { BLOCKING_METADATA_AGENTS } from "./src/shared/lib/streaming-metadata";
import { duplicateHostRedirects } from "./src/shared/lib/duplicate-hosts";

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
  // Metadata goes into <head> before the page starts for every reader, except people on pages whose metadata
  // is in the prerendered shell anyway: they get the shell at once (src/shared/lib/streaming-metadata.ts).
  htmlLimitedBots: BLOCKING_METADATA_AGENTS,
  cacheComponents: true,
  partialPrefetching: true,
  // Catalog photos from Vercel Blob are resized here (src/shared/lib/images.ts). Few widths and one format keep
  // the number of optimized variants, which hosting plans count, small; a Blob URL never changes its content.
  images: {
    remotePatterns: [{ protocol: "https", hostname: CATALOG_PHOTO_HOST, pathname: "/catalog/**" }],
    imageSizes: [64, 128, 256, 384],
    deviceSizes: [640, 828, 1080, 1600],
    qualities: [75],
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
  },
  async headers() {
    const publicHtmlCache = [
      { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=3600" },
      { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=3600" },
    ];
    const immutableAssetCache = [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ];
    const privateNoStore = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store" },
      { key: "CDN-Cache-Control", value: "private, no-store" },
      { key: "Vercel-CDN-Cache-Control", value: "private, no-store" },
    ];
    return [
      { source: "/brand/:path*", headers: immutableAssetCache },
      { source: "/mascot/:path*", headers: immutableAssetCache },
      ...[
        "/",
        "/about",
        "/blog",
        "/blog/:slug",
        "/brands",
        "/brands/:slug",
        "/catalog",
        "/catalog/:path*",
        "/contacts",
        "/offer",
        "/payment-delivery",
        "/privacy",
        "/product/:slug",
        "/returns",
        "/sale",
        "/services",
        "/services/:slug",
      ].map((source) => ({ source, headers: publicHtmlCache })),
      ...["/cart", "/checkout", "/compare", "/order/:number", "/account/:path*", "/pay/sandbox/:id", "/api/:path*", "/internal/:path*"].map((source) => ({
        source,
        headers: privateNoStore,
      })),
    ];
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
      ...duplicateHostRedirects(process.env.SITE_URL),
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
