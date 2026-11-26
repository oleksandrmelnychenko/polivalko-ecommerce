import type { Metadata } from "next";
import { listingIndexState } from "@/features/catalog";
import { CatalogScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ searchParams }: PageProps<"/catalog">): Promise<Metadata> {
  const { page, filtered } = listingIndexState(await searchParams);
  const paged = page > 1 && !filtered;
  return seoMetadata({
    title: paged ? `Каталог товарів для саду — стор. ${page}` : "Каталог товарів для поливу, саду й городу",
    description: paged
      ? `Сторінка ${page}. Каталог Poli Valko: полив, насіння, добрива, садовий інструмент і техніка. Доставка Новою поштою по Україні та самовивіз у Бучі.`
      : "Каталог Poli Valko: усе для поливу, насіння, добрива, садовий інструмент і техніка. Доставка Новою поштою по Україні та самовивіз у Бучі.",
    path: paged ? `/catalog?page=${page}` : "/catalog",
    noIndex: filtered,
  });
}

export default function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  return <CatalogScreen searchParams={searchParams} />;
}
