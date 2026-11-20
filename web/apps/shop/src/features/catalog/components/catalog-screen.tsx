import Link from "next/link";
import { Suspense } from "react";
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from "@/features/seo";
import { getCategoryTree } from "../api/server";
import { categoryPhotoUrl } from "../lib/category-photo";
import { listingIndexState, type SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { CategoryCards } from "./category-cards";
import { ListingSkeleton } from "./listing-skeleton";

export function CatalogScreen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="container">
      <JsonLd data={breadcrumbJsonLd([{ name: "Каталог", path: "/catalog" }])} />
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li aria-current="page">Каталог</li>
          </ol>
        </nav>
        <h1>Каталог</h1>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
        <CatalogCategories searchParams={searchParams} />
      </Suspense>
      <section aria-labelledby="catalog-products">
        <h2 id="catalog-products">Товари</h2>
        <Suspense fallback={<ListingSkeleton head={false} />}>
          <CatalogListing
            basePath="/catalog"
            base={{}}
            searchParams={searchParams}
            listName="Товари каталогу"
            emptyHint="У каталозі поки немає товарів."
          />
        </Suspense>
      </section>
    </div>
  );
}

async function CatalogCategories({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { page, filtered } = listingIndexState(await searchParams);
  if (page > 1 || filtered) return null;
  const categories = await getCategoryTree();
  return (
    <>
      {categories.length > 0 && (
        <JsonLd
          data={itemListJsonLd(
            "Каталог",
            categories.map((c) => ({ name: c.name, path: `/catalog/${c.slug}`, image: categoryPhotoUrl(c) })),
          )}
        />
      )}
      <CategoryCards categories={categories} />
    </>
  );
}
