import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogListing, ListingSkeleton } from "@/components/catalog-listing";
import { first } from "@/lib/format";

export const metadata: Metadata = {
  title: "Пошук",
  robots: { index: false, follow: true },
};

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <div className="container">
      <Suspense fallback={<ListingSkeleton />}>
        <SearchResults {...props} />
      </Suspense>
    </div>
  );
}

async function SearchResults({ searchParams }: PageProps<"/search">) {
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
