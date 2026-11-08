import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from "@/features/seo";
import { getCategoryTree } from "../api/server";
import { categoryPhotoUrl } from "../lib/category-photo";
import { CategoryGrid } from "./category-grid";

export function CatalogScreen() {
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
        <CatalogCategories />
      </Suspense>
    </div>
  );
}

async function CatalogCategories() {
  await connection();
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
      <CategoryGrid categories={categories} />
    </>
  );
}
