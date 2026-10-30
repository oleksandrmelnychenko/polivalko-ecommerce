import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryGrid as CategoryTiles } from "@/components/category-cards";
import { getCategoryTree } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Каталог",
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
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
        <CategoryGrid />
      </Suspense>
    </div>
  );
}

async function CategoryGrid() {
  await connection();
  const categories = await getCategoryTree();
  return <CategoryTiles categories={categories} />;
}
