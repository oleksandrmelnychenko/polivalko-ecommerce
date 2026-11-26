import { connection } from "next/server";
import { getSitemap } from "@/features/catalog/server";
import { SITEMAP_XML_HEADERS, sitemapXml, siteUrl } from "@/features/seo";

export async function GET() {
  await connection();
  const site = siteUrl();
  const { brands } = await getSitemap();
  const entries = brands.map((b) => ({
    url: `${site}/brands/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));
  return new Response(sitemapXml(entries), { headers: SITEMAP_XML_HEADERS });
}
