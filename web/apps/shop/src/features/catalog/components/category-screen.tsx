import { Suspense } from "react";
import type { Category } from "@polivalko/shared/api/types";
import type { SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { CategoryHead } from "./category-head";
import { ListingSkeleton } from "./listing-skeleton";

type CategoryScreenProps = { category: Category; searchParams: Promise<SearchParams> };

/** The page resolves the category first (see requireCategory), so a missing one is a real 404. */
export function CategoryScreen({ category, searchParams }: CategoryScreenProps) {
  return (
    <div className="container">
      <CategoryHead category={category} />
      <Suspense fallback={<ListingSkeleton head={false} />}>
        <CategoryListing category={category} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryListing({ category, searchParams }: CategoryScreenProps) {
  return (
    <CatalogListing
      basePath={`/catalog/${category.slug}`}
      base={{ category: category.slug }}
      searchParams={await searchParams}
      subcategories={category.children}
      listName={category.name}
      emptyHint="У цьому розділі поки немає товарів. Загляньте в інші розділи каталогу."
    />
  );
}
