import type { Metadata } from "next";
import { listingIndexState, saleIsEmpty } from "@/features/catalog";
import { countSaleProducts, SaleScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ searchParams }: PageProps<"/sale">): Promise<Metadata> {
  const { page, filtered } = listingIndexState(await searchParams, "/sale");
  const paged = page > 1 && !filtered;
  return seoMetadata({
    title: paged ? `Акції й знижки на товари — стор. ${page}` : "Акції й знижки на товари для саду й поливу",
    description: paged
      ? `Сторінка ${page}. Акції й знижки Poli Valko на полив, інструмент, насіння й добрива. Доставка Новою поштою по Україні та самовивіз у Бучі.`
      : "Акції та сезонні знижки в Poli Valko на системи поливу, садовий інструмент, насіння й добрива. Доставка Новою поштою та самовивіз у Бучі.",
    path: paged ? `/sale?page=${page}` : "/sale",
    // With no sale products the page has nothing to show; the sitemap leaves it out by the same check.
    noIndex: filtered || saleIsEmpty(await countSaleProducts()),
  });
}

export default function SalePage({ searchParams }: PageProps<"/sale">) {
  return <SaleScreen searchParams={searchParams} />;
}
