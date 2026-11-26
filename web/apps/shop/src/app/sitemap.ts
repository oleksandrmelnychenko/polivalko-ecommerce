import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { saleIsEmpty } from "@/features/catalog";
import { countSaleProducts, getSitemap } from "@/features/catalog/server";
import { getPage } from "@/features/content/server";
import { getServiceDirectionPage, getServiceDirections } from "@/features/services/server";
import { latestChange, siteUrl, staticSitemapEntries } from "@/features/seo";
import { articles } from "@/features/journal/server";
import { JOURNAL_ENABLED } from "@/features/journal";

const STATIC_PAGES = ["", "/catalog", "/brands", "/sale", "/services", "/contacts", "/payment-delivery", "/returns", "/offer", "/privacy", "/about", ...(JOURNAL_ENABLED ? ["/blog", ...articles.map((article) => `/blog/${article.slug}`)] : [])];
// Pages whose text is edited in the console: each keeps the date of its last change.
const TEXT_PAGES = ["payment-delivery", "returns", "offer", "privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const site = siteUrl();
  const [{ categories, products, brands }, services, saleProducts, textPageDates] = await Promise.all([
    getSitemap(),
    getServiceDirections().catch(() => []),
    countSaleProducts(),
    Promise.all(TEXT_PAGES.map(async (slug) => [`/${slug}`, (await getPage(slug).catch(() => null))?.updatedAt] as const)),
  ]);
  // A service's change date comes with its page; a failed lookup only leaves that entry without a date.
  const serviceDates = new Map(await Promise.all(services.map(async (s) => [s.slug, (await getServiceDirectionPage(s.slug).catch(() => null))?.updatedAt] as const)));
  // An empty sale page is noindex (see sale/page.tsx), so it is not advertised here either.
  const pages = saleIsEmpty(saleProducts) ? STATIC_PAGES.filter((path) => path !== "/sale") : STATIC_PAGES;
  // «Послуги» lists every service, so it changed when the latest of them did. The home page, the catalog, contacts
  // and «Про нас» have no stored change date and go without one.
  // «Бренди» lists every brand page, so it changed when the latest of them did.
  const changedAt = {
    ...Object.fromEntries(textPageDates),
    "/services": latestChange([...serviceDates.values()]),
    "/brands": latestChange(brands.map((b) => b.updatedAt)),
  };
  return [
    ...staticSitemapEntries(site, pages, changedAt),
    // Only service pages with their own text: a stub page is noindex (see services/[slug]).
    ...services.filter((s) => s.hasPage).map((s) => {
      const lastModified = serviceDates.get(s.slug);
      return { url: `${site}/services/${s.slug}`, ...(lastModified ? { lastModified } : {}), changeFrequency: "monthly" as const, priority: 0.7 };
    }),
    ...categories.map((c) => ({ url: `${site}/catalog/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: `${site}/brands/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${site}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
