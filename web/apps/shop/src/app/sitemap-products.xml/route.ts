import { connection } from "next/server";
import { getSitemap } from "@/features/catalog/server";
import { SITEMAP_XML_HEADERS, sitemapXml, siteUrl } from "@/features/seo";

export async function GET() {
  await connection();
  const site = siteUrl();
  const { products } = await getSitemap();
  const entries = products.map((p) => ({
    url: `${site}/product/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
  return new Response(sitemapXml(entries), { headers: SITEMAP_XML_HEADERS });
}
