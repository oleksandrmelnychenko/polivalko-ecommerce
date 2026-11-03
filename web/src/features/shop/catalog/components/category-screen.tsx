import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getCategory, resolveRedirect } from "../api/server";
import type { SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { CategoryHead } from "./category-head";
import { ListingSkeleton } from "./listing-skeleton";

type CategoryScreenProps = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export function CategoryScreen(props: CategoryScreenProps) {
  return (
    <div className="container">
      <Suspense fallback={<ListingSkeleton crumbs />}>
        <CategoryContent {...props} />
      </Suspense>
    </div>
  );
}

async function CategoryContent({ params, searchParams }: CategoryScreenProps) {
  const { slug } = await params;
  const [category, sp] = await Promise.all([getCategory(slug), searchParams]);
  if (!category) {
    const target = await resolveRedirect(`/catalog/${slug}`);
    if (target) permanentRedirect(target);
    notFound();
  }

  return (
    <>
      <CategoryHead category={category} />
      <CatalogListing
        basePath={`/catalog/${slug}`}
        base={{ category: slug }}
        searchParams={sp}
        emptyHint="У цьому розділі поки немає товарів. Загляньте в інші розділи каталогу."
      />
    </>
  );
}
