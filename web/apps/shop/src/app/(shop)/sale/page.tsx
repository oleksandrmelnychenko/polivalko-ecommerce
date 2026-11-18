import type { Metadata } from "next";
import { listingIndexState } from "@/features/catalog";
import { SALE_LEAD, SALE_TITLE, SaleScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ searchParams }: PageProps<"/sale">): Promise<Metadata> {
  const { page, filtered } = listingIndexState(await searchParams);
  const paged = page > 1 && !filtered;
  return seoMetadata({
    title: paged ? `${SALE_TITLE}, сторінка ${page}` : SALE_TITLE,
    description: SALE_LEAD,
    path: paged ? `/sale?page=${page}` : "/sale",
    noIndex: filtered,
  });
}

export default function SalePage({ searchParams }: PageProps<"/sale">) {
  return <SaleScreen searchParams={searchParams} />;
}
