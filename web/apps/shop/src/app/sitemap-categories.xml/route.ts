import { connection } from "next/server";
import { getSitemap } from "@/features/catalog/server";
import { SITEMAP_XML_HEADERS, sitemapXml, siteUrl } from "@/features/seo";

export async function GET() {
  await connection();
  const site = siteUrl();
  const { categories } = await getSitemap();
  const entries = categories.map((c) => ({
    url: `${site}/catalog/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
  return new Response(sitemapXml(entries), { headers: SITEMAP_XML_HEADERS });
}
