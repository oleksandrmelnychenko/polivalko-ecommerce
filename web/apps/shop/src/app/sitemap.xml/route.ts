import { connection } from "next/server";
import { getSitemap } from "@/features/catalog/server";
import { getPage } from "@/features/content/server";
import { JOURNAL_ENABLED } from "@/features/journal";
import { articles } from "@/features/journal/server";
import { latestChange, SITEMAP_XML_HEADERS, sitemapIndexXml, siteUrl, type SitemapIndexEntry } from "@/features/seo";
import { getServiceDirectionPage, getServiceDirections } from "@/features/services/server";

const TEXT_PAGES = ["payment-delivery", "returns"];

export async function GET() {
  await connection();
  const site = siteUrl();
  const [{ categories, products, brands }, services, textPageDates] = await Promise.all([
    getSitemap(),
    getServiceDirections().catch(() => []),
    Promise.all(TEXT_PAGES.map(async (slug) => (await getPage(slug).catch(() => null))?.updatedAt)),
  ]);
  const indexableServices = services.filter((s) => s.hasPage);
  const serviceDates = await Promise.all(
    indexableServices.map(async (s) => (await getServiceDirectionPage(s.slug).catch(() => null))?.updatedAt),
  );

  const categoriesLastMod = latestChange(categories.map((c) => c.updatedAt));
  const brandsLastMod = latestChange(brands.map((b) => b.updatedAt));
  const servicesLastMod = latestChange(serviceDates);
  const productsLastMod = latestChange(products.map((p) => p.updatedAt));
  const blogLastMod = JOURNAL_ENABLED
    ? latestChange(articles.map((article) => article.dateModified || article.datePublished))
    : undefined;
  const pagesLastMod = latestChange([...textPageDates, servicesLastMod, brandsLastMod, categoriesLastMod, blogLastMod]);

  const categoryBrandsLastMod = latestChange([categoriesLastMod, brandsLastMod]);
  const sitemaps: SitemapIndexEntry[] = [
    { url: `${site}/sitemap-pages.xml`, ...(pagesLastMod ? { lastModified: pagesLastMod } : {}) },
    { url: `${site}/sitemap-categories.xml`, ...(categoriesLastMod ? { lastModified: categoriesLastMod } : {}) },
    ...(brands.length > 0 ? [{ url: `${site}/sitemap-brands.xml`, ...(brandsLastMod ? { lastModified: brandsLastMod } : {}) }] : []),
    ...(categories.length > 0 && brands.length > 0
      ? [{ url: `${site}/sitemap-category-brands.xml`, ...(categoryBrandsLastMod ? { lastModified: categoryBrandsLastMod } : {}) }]
      : []),
    ...(indexableServices.length > 0 ? [{ url: `${site}/sitemap-services.xml`, ...(servicesLastMod ? { lastModified: servicesLastMod } : {}) }] : []),
    { url: `${site}/sitemap-products.xml`, ...(productsLastMod ? { lastModified: productsLastMod } : {}) },
  ];

  return new Response(sitemapIndexXml(sitemaps), { headers: SITEMAP_XML_HEADERS });
}
