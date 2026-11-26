import type { Metadata } from "next";
import { listingIndexState, saleIsEmpty } from "@/features/catalog";
import { countSaleProducts, SALE_LEAD, SALE_TITLE, SaleScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ searchParams }: PageProps<"/sale">): Promise<Metadata> {
  const { page, filtered } = listingIndexState(await searchParams, "/sale");
  const paged = page > 1 && !filtered;
  return seoMetadata({
    title: paged ? `${SALE_TITLE}, сторінка ${page}` : "Акції й знижки на товари для саду",
    description: SALE_LEAD,
    path: paged ? `/sale?page=${page}` : "/sale",
    // With no sale products the page has nothing to show; the sitemap leaves it out by the same check.
    noIndex: filtered || saleIsEmpty(await countSaleProducts()),
  });
}

export default function SalePage({ searchParams }: PageProps<"/sale">) {
  return <SaleScreen searchParams={searchParams} />;
}
