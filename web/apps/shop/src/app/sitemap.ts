import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemap } from "@/features/catalog/server";
import { siteUrl } from "@/features/seo";

const STATIC_PAGES = ["", "/catalog", "/services", "/contacts", "/payment-delivery", "/returns", "/offer", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const site = siteUrl();
  const { categories, products } = await getSitemap();
  return [
    ...STATIC_PAGES.map((path) => ({ url: `${site}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.5 })),
    ...categories.map((c) => ({ url: `${site}/catalog/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
