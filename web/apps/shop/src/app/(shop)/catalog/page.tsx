import type { Metadata } from "next";
import { listingIndexState } from "@/features/catalog";
import { CatalogScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ searchParams }: PageProps<"/catalog">): Promise<Metadata> {
  const { page, filtered } = listingIndexState(await searchParams);
  const paged = page > 1 && !filtered;
  return seoMetadata({
    title: paged ? `Каталог, сторінка ${page}` : "Каталог товарів для саду, городу й дому",
    description: "Каталог товарів Poli Valko для саду, городу й дому з доставкою Новою поштою по Україні або самовивозом з магазину.",
    path: paged ? `/catalog?page=${page}` : "/catalog",
    noIndex: filtered,
  });
}

export default function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  return <CatalogScreen searchParams={searchParams} />;
}
