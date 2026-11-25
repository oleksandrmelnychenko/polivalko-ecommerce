import type { Category } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { getCategory } from "../api/server";
import type { SearchParams } from "../lib/listing-params";
import { FirstPageIntro } from "./category-intro";
import { CategoryChips } from "./category-chips";

export async function CategoryHead({ category, searchParams }: { category: Category; searchParams: Promise<SearchParams> }) {
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
        <h1>{category.name}</h1>
        <FirstPageIntro description={category.description} searchParams={searchParams} />
        {parent && siblings?.length ? (
          <CategoryChips label={`Підрозділи «${parent.name}»`} items={siblings} current={category.slug} />
        ) : null}
        {category.children.length > 0 && (
          <CategoryChips label={`Підрозділи «${category.name}»`} items={category.children} />
        )}
      </header>
    </>
  );
}
