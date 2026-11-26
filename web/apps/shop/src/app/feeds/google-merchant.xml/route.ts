import { connection } from "next/server";
import { merchantFeedXml } from "@/features/catalog";
import { getMerchantFeed } from "@/features/catalog/server";
import { SITE_NAME, siteUrl } from "@/features/seo";

/**
 * The product feed a shopping service fetches on a schedule.
 * Nothing here catches a failure: when the catalog does not answer, or answers with no products, the response is
 * an error. An empty file served as a valid feed would make the service drop every product.
 */
export async function GET() {
  await connection();
  const xml = merchantFeedXml(await getMerchantFeed(), { url: siteUrl(), name: SITE_NAME, description: "Товари для саду, городу й дому" });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      // The file is for the shopping service, not for search results.
      "X-Robots-Tag": "noindex",
    },
  });
}
