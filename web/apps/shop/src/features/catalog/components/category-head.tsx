import type { ReactNode } from "react";
import type { Category } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { getCategoryTree } from "../api/server";
import { categoryChildren } from "../lib/category-path";
import { CategoryChips } from "./category-chips";

/** Differentiates catalog H1s that otherwise duplicate a service page or brand hub H1. */
const CATEGORY_H1_OVERRIDES: Record<string, string> = {
  "landshaftnyi-dyzain": "Товари для ландшафтного дизайну",
  hunter: "Автополив Hunter",
  irritec: "Комплектуючі для поливу Irritec",
};

export function categoryHeading(category: Pick<Category, "slug" | "name">): string {
  return CATEGORY_H1_OVERRIDES[category.slug] ?? category.name;
}

export function CategoryHead({ category, children }: { category: Category; children: ReactNode }) {
  const parents = [
    { name: "Каталог", path: "/catalog" },
    ...category.breadcrumbs.map((c) => ({ name: c.name, path: `/catalog/${c.slug}` })),
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([...parents, { name: category.name, path: `/catalog/${category.slug}` }])} />
      <Breadcrumbs current={category.name} parents={parents} />
      <header className="page-head">
        <h1>{categoryHeading(category)}</h1>
        <CategoryNavigation category={category} />
        {children}
      </header>
    </>
  );
}

export async function CategoryNavigation({ category, withinCategory = false }: { category: Category; withinCategory?: boolean }) {
  const parent = category.breadcrumbs.at(-1);
  const siblings = parent ? categoryChildren(await getCategoryTree().catch(() => []), parent.slug) : undefined;
  return (
    <>
      {!!siblings?.length && <CategoryChips label="Категорії" items={siblings} current={category.slug} withinCategory={withinCategory} />}
      {category.children.length > 0 && <CategoryChips label={parent ? "Підкатегорії" : "Категорії"} items={category.children} />}
    </>
  );
}
