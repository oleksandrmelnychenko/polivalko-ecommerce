import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { Suspense } from "react";
import { ListingSkeleton, type SearchParams } from "@/features/catalog";
import { CatalogListing } from "@/features/catalog/server";
import { first } from "@polivalko/shared/lib/format";

type SearchScreenProps = { searchParams: Promise<SearchParams> };

export function SearchScreen(props: SearchScreenProps) {
  return (
    <div className="container listing-page">
      <Breadcrumbs current="Пошук" />
      <Suspense fallback={<ListingSkeleton />}>
        <SearchResults {...props} />
      </Suspense>
    </div>
  );
}

async function SearchResults({ searchParams }: SearchScreenProps) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";

  if (!q) {
    return (
      <header className="page-head">
        <h1>Пошук товарів</h1>
        <p>Введіть назву товару або артикул у полі пошуку вгорі.</p>
      </header>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1>Пошук: «{q}»</h1>
      </header>
      <CatalogListing
        compact
        basePath="/search"
        base={{ q }}
        fixed={{ q }}
        searchParams={sp}
        emptyHint="Перевірте написання, скоротіть запит або введіть артикул товару."
      />
    </>
  );
}
