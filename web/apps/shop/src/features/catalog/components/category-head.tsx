import type { ReactNode } from "react";
import type { Category } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { getCategory } from "../api/server";
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

export async function CategoryHead({ category, children }: { category: Category; children: ReactNode }) {
  const parents = [
    { name: "Каталог", path: "/catalog" },
    ...category.breadcrumbs.map((c) => ({ name: c.name, path: `/catalog/${c.slug}` })),
  ];
  const parent = category.breadcrumbs.at(-1);
  const siblings = parent ? (await getCategory(parent.slug).catch(() => null))?.children : undefined;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([...parents, { name: category.name, path: `/catalog/${category.slug}` }])} />
      <Breadcrumbs current={category.name} parents={parents} />
      <header className="page-head">
        <h1>{categoryHeading(category)}</h1>
        <CategoryChips label={`Розділи та бренди «${category.name}»`} items={[...(siblings ?? []), ...category.children]} current={category.slug}>
          {children}
        </CategoryChips>
      </header>
    </>
  );
}
