import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { getCategoryTree } from "../api/server";
import { listingIndexState, type SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { CategoryCards } from "./category-cards";
import { ListingSkeleton } from "./listing-skeleton";

export function CatalogScreen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="container catalog-page listing-page">
      <Breadcrumbs current="Каталог" />
      <JsonLd data={breadcrumbJsonLd([{ name: "Каталог", path: "/catalog" }])} />
      <header className="page-head">
        <h1>Каталог</h1>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
        <CatalogCategories searchParams={searchParams} />
      </Suspense>
      <section aria-label="Товари">
        <Suspense fallback={<ListingSkeleton head={false} />}>
          <CatalogProducts searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function CatalogCategories({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { page, filtered } = listingIndexState(await searchParams);
  if (page > 1 || filtered) return null;
  const categories = await getCategoryTree();
  return <CategoryCards categories={categories} />;
}

async function CatalogProducts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <CatalogListing
      compact
      basePath="/catalog"
      base={{}}
      searchParams={await searchParams}
      listName="Товари каталогу"
      emptyHint="У каталозі поки немає товарів."
    />
  );
}
