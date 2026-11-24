import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import type { SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { ProductTilesSkeleton } from "./product-tiles-skeleton";

export const SALE_TITLE = "Акції";
export const SALE_LEAD = "Акційні пропозиції Полі-Валько для дому, саду й городу.";

export function SaleScreen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="container sale-page listing-page">
      <JsonLd data={breadcrumbJsonLd([{ name: SALE_TITLE, path: "/sale" }])} />
      <header className="page-head">
        <h1>{SALE_TITLE}</h1>
      </header>
      <Suspense fallback={<div className="catalog" aria-busy="true"><div className="catalog__main"><div className="sale-controls-skeleton skeleton" /><ProductTilesSkeleton count={5} /></div><div className="filters-panel sale-controls-skeleton skeleton" aria-hidden="true" /></div>}>
        <SaleListing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SaleListing({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <CatalogListing
      basePath="/sale"
      base={{ onSale: true }}
      searchParams={sp}
      saleOnly
      listName={SALE_TITLE}
      emptyHint="Зараз товарів зі знижкою немає. Подивіться весь каталог."
    />
  );
}
