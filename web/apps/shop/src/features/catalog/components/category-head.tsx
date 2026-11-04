import Link from "next/link";
import type { Category } from "@polivalko/shared/api/types";

export function CategoryHead({ category }: { category: Category }) {
  return (
    <header className="page-head">
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
          <li aria-current="page">{category.name}</li>
        </ol>
      </nav>
      <h1>{category.name}</h1>
      {category.children.length > 0 && (
        <nav aria-label="Підрозділи">
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
