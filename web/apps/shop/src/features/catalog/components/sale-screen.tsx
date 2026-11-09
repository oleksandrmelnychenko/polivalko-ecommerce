import Link from "next/link";
import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import type { SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { ListingSkeleton } from "./listing-skeleton";

export const SALE_TITLE = "Акції";
export const SALE_LEAD = "Товари зі зниженою ціною. Стару ціну закреслено, нова стоїть поруч.";

export function SaleScreen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="container">
      <JsonLd data={breadcrumbJsonLd([{ name: SALE_TITLE, path: "/sale" }])} />
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li aria-current="page">{SALE_TITLE}</li>
          </ol>
        </nav>
        <h1>{SALE_TITLE}</h1>
        <p>{SALE_LEAD}</p>
      </header>
      <Suspense fallback={<ListingSkeleton />}>
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
