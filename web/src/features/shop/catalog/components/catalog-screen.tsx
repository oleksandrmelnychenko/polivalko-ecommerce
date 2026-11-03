import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCategoryTree } from "../api/server";
import { CategoryGrid } from "./category-grid";

export function CatalogScreen() {
  return (
    <div className="container">
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
  return <CategoryGrid categories={categories} />;
}
