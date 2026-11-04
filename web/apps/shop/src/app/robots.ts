import type { MetadataRoute } from "next";
import { connection } from "next/server";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/internal/", "/search", "/cart", "/checkout", "/order/", "/pay/"],
    },
    sitemap: `${process.env.SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
