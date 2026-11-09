import type { Metadata } from "next";
import { SALE_LEAD, SALE_TITLE, SaleScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ searchParams }: PageProps<"/sale">): Promise<Metadata> {
  const sp = await searchParams;
  const keys = Object.keys(sp).filter((key) => sp[key] !== undefined && sp[key] !== "");
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const paged = keys.length === 1 && keys[0] === "page" && Number.isInteger(page) && page > 1;
  return seoMetadata({
    title: paged ? `${SALE_TITLE}, сторінка ${page}` : SALE_TITLE,
    description: SALE_LEAD,
    path: paged ? `/sale?page=${page}` : "/sale",
    noIndex: keys.length > 0 && !paged,
  });
}

export default function SalePage({ searchParams }: PageProps<"/sale">) {
  return <SaleScreen searchParams={searchParams} />;
}
