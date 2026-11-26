import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemap } from "@/features/catalog/server";
import { getServiceDirections } from "@/features/services/server";
import { siteUrl } from "@/features/seo";
import { articles } from "@/features/journal/server";
import { JOURNAL_ENABLED } from "@/features/journal";

const STATIC_PAGES = ["", "/catalog", "/sale", "/services", "/contacts", "/payment-delivery", "/returns", "/offer", "/privacy", "/about", ...(JOURNAL_ENABLED ? ["/blog", ...articles.map((article) => `/blog/${article.slug}`)] : [])];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const site = siteUrl();
  const [{ categories, products }, services] = await Promise.all([getSitemap(), getServiceDirections().catch(() => [])]);
  return [
    ...STATIC_PAGES.map((path) => ({ url: `${site}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.5 })),
    // Only service pages with their own text: a stub page is noindex (see services/[slug]).
    ...services.filter((s) => s.hasPage).map((s) => ({ url: `${site}/services/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...categories.map((c) => ({ url: `${site}/catalog/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
