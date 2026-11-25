import Link from "next/link";
import type { Category } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import type { SearchParams } from "../lib/listing-params";
import { FirstPageIntro } from "./category-intro";

export function CategoryHead({ category, searchParams }: { category: Category; searchParams: Promise<SearchParams> }) {
  const trail = [
    { name: "Каталог", path: "/catalog" },
    ...category.breadcrumbs.map((c) => ({ name: c.name, path: `/catalog/${c.slug}` })),
    { name: category.name, path: `/catalog/${category.slug}` },
  ];
  return (
    <header className="page-head">
      <JsonLd data={breadcrumbJsonLd(trail)} />
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/catalog">Каталог</Link>
          </li>
          {category.breadcrumbs.map((c) => (
            <li key={c.id}>
              <Link href={`/catalog/${c.slug}`}>{c.name}</Link>
            </li>
          ))}
        </ol>
      </nav>
      <h1>{category.name}</h1>
      <FirstPageIntro description={category.description} searchParams={searchParams} />
      {category.children.length > 0 && (
        <nav aria-label="Підрозділи" className="page-head__subs">
          <ul className="chips chips--grey">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link href={`/catalog/${child.slug}`}>{child.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
