import { connection } from "next/server";
import { saleIsEmpty } from "@/features/catalog";
import { countSaleProducts, getSitemap } from "@/features/catalog/server";
import { getPage } from "@/features/content/server";
import { JOURNAL_ENABLED } from "@/features/journal";
import { articles } from "@/features/journal/server";
import { latestChange, SITEMAP_XML_HEADERS, sitemapXml, siteUrl, staticSitemapEntries } from "@/features/seo";
import { getServiceDirectionPage, getServiceDirections } from "@/features/services/server";

// Exclude low-value legal pages (/offer, /privacy) from the XML sitemap; they remain crawlable from the footer.
const STATIC_PAGES = [
  "/",
  "/catalog",
  "/brands",
  "/sale",
  "/services",
  "/contacts",
  "/payment-delivery",
  "/returns",
  "/about",
  ...(JOURNAL_ENABLED ? ["/blog", ...articles.map((article) => `/blog/${article.slug}`)] : []),
];
const TEXT_PAGES = ["payment-delivery", "returns"];

export async function GET() {
  await connection();
  const site = siteUrl();
  const [{ categories, products, brands }, services, saleProducts, textPageDates] = await Promise.all([
    getSitemap(),
    getServiceDirections().catch(() => []),
    countSaleProducts(),
    Promise.all(TEXT_PAGES.map(async (slug) => [`/${slug}`, (await getPage(slug).catch(() => null))?.updatedAt] as const)),
  ]);
  const serviceDates = await Promise.all(
    services.filter((s) => s.hasPage).map(async (s) => (await getServiceDirectionPage(s.slug).catch(() => null))?.updatedAt),
  );
  const pages = saleIsEmpty(saleProducts) ? STATIC_PAGES.filter((path) => path !== "/sale") : STATIC_PAGES;

  const blogLastMod = JOURNAL_ENABLED
    ? latestChange(articles.map((article) => article.dateModified || article.datePublished))
    : undefined;
  const articleDates = JOURNAL_ENABLED
    ? Object.fromEntries(articles.map((article) => [`/blog/${article.slug}`, article.dateModified || article.datePublished]))
    : {};
  const catalogLastMod = latestChange([...categories.map((c) => c.updatedAt), ...products.map((p) => p.updatedAt)]);
  const brandsLastMod = latestChange(brands.map((b) => b.updatedAt));
  const servicesLastMod = latestChange(serviceDates);
  const saleLastMod = latestChange(products.map((p) => p.updatedAt));
  const textLastMod = latestChange(textPageDates.map(([, date]) => date));
  const siteLastMod = latestChange([catalogLastMod, brandsLastMod, servicesLastMod, textLastMod, blogLastMod]);

  const changedAt: Record<string, string | null | undefined> = {
    ...Object.fromEntries(textPageDates),
    ...articleDates,
    "/": siteLastMod,
    "/catalog": catalogLastMod,
    "/brands": brandsLastMod,
    "/sale": saleLastMod,
    "/services": servicesLastMod,
    "/contacts": textLastMod ?? siteLastMod,
    "/about": textLastMod ?? siteLastMod,
    ...(blogLastMod ? { "/blog": blogLastMod } : {}),
  };

  return new Response(sitemapXml(staticSitemapEntries(site, pages, changedAt)), {
    headers: SITEMAP_XML_HEADERS,
  });
}
