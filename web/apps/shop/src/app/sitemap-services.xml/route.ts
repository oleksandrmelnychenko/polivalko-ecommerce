import { connection } from "next/server";
import { SITEMAP_XML_HEADERS, sitemapXml, siteUrl } from "@/features/seo";
import { getServiceDirectionPage, getServiceDirections } from "@/features/services/server";

export async function GET() {
  await connection();
  const site = siteUrl();
  const services = (await getServiceDirections().catch(() => [])).filter((s) => s.hasPage);
  const serviceDates = new Map(
    await Promise.all(services.map(async (s) => [s.slug, (await getServiceDirectionPage(s.slug).catch(() => null))?.updatedAt] as const)),
  );
  const entries = services.map((s) => {
    const lastModified = serviceDates.get(s.slug);
    return {
      url: `${site}/services/${s.slug}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    };
  });
  return new Response(sitemapXml(entries), { headers: SITEMAP_XML_HEADERS });
}
