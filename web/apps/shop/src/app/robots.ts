import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/features/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/internal/", "/cart", "/checkout", "/order/", "/pay/", "/account"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
