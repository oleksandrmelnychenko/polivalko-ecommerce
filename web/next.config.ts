import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:5080";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Локальна розробка без Caddy: браузер звертається до /api/v1 на тому самому origin,
  // а Next.js лише проксіює запит до ASP.NET Core. У production /api/* обробляє reverse proxy
  // ще до Next.js. Бізнес-логіки тут немає (розділ 2 ТЗ).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
};

export default nextConfig;
