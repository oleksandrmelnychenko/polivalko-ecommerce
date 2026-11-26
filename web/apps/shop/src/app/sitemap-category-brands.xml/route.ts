import { connection } from "next/server";
import {
  CATEGORY_BRAND_PRIORITY_MATRIX,
  duplicateSubcategoryRedirect,
  resolveCatalogRobotsAndCanonical,
} from "@/features/catalog";
import { getSitemap, searchProducts } from "@/features/catalog/server";
import { latestChange, SITEMAP_XML_HEADERS, sitemapXml, siteUrl, type SitemapUrlEntry } from "@/features/seo";

/**
 * Dedicated sitemap for curated, non-duplicate Category × Brand SEO landing pages (`/catalog/[slug]/[brand]`).
 * Every candidate is verified against live sitemap categories, live indexable brands, duplicate L3 subcategory guards,
 * and real product counts (>= MIN_PRODUCTS_FOR_CATEGORY_BRAND) via `resolveCatalogRobotsAndCanonical`.
 */
export async function GET() {
  await connection();
  const site = siteUrl();
  const { categories, brands } = await getSitemap();
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));

  const candidates = CATEGORY_BRAND_PRIORITY_MATRIX.filter((entry) => {
    if (!categoryBySlug.has(entry.categorySlug) || !brandBySlug.has(entry.brandSlug)) return false;
    return duplicateSubcategoryRedirect(entry.categorySlug, entry.brandSlug) === null;
  });

  const resolved = await Promise.all(
    candidates.map(async (entry): Promise<SitemapUrlEntry | null> => {
      const preview = await searchProducts({
        category: entry.categorySlug,
        brandPage: entry.brandSlug,
        pageSize: 1,
      }).catch(() => null);
      const totalProducts = preview?.totalItems ?? 0;
      const decision = resolveCatalogRobotsAndCanonical({
        routeType: "category_brand",
        categorySlug: entry.categorySlug,
        brandSlug: entry.brandSlug,
        totalProducts,
      });
      if (!decision.inSitemap) return null;

      const lastModified = latestChange([
        categoryBySlug.get(entry.categorySlug)?.updatedAt,
        brandBySlug.get(entry.brandSlug)?.updatedAt,
      ]);
      return {
        url: `${site}${decision.canonicalPath}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: "daily",
        priority: 0.7,
      };
    }),
  );

  const entries = resolved.filter((entry): entry is SitemapUrlEntry => entry !== null);
  return new Response(sitemapXml(entries), { headers: SITEMAP_XML_HEADERS });
}
