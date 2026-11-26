import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/features/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The cart, the checkout and the account are noindex in their own markup; a robot has to be able to fetch a
      // page to see that, so they are not closed here. Token pages (orders, payments) and the API stay closed.
      disallow: ["/api/", "/internal/", "/order/", "/pay/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
