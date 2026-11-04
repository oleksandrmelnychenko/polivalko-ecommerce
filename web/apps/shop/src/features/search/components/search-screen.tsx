import { Suspense } from "react";
import { ListingSkeleton, type SearchParams } from "@/features/catalog";
import { CatalogListing } from "@/features/catalog/server";
import { first } from "@polivalko/shared/lib/format";

type SearchScreenProps = { searchParams: Promise<SearchParams> };

export function SearchScreen(props: SearchScreenProps) {
  return (
    <div className="container">
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
        <h1>Що шукаємо?</h1>
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
        basePath="/search"
        base={{ q }}
        fixed={{ q }}
        searchParams={sp}
        emptyHint="Перевірте написання або пошукайте за артикулом, наприклад DEMO-001."
      />
    </>
  );
}
