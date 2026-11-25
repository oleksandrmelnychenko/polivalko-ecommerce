import Link from "next/link";
import { GridIcon } from "@polivalko/shared/ui/icons";
import { thumb } from "@/shared/lib/images";
import type { MenuCategory } from "../lib/menu-category";

export function containsCategory(category: MenuCategory, pathname: string): boolean {
  return pathname === `/catalog/${category.slug}` || category.children.some(child => containsCategory(child, pathname));
}

export function CategoryPicture({ category }: { category: MenuCategory }) {
  return <span className="menu-category-picture" aria-hidden="true">
    {category.photo ? <img src={thumb(category.photo, 120)} alt="" width={38} height={38} loading="lazy" /> : <GridIcon />}
  </span>;
}

export function CategoryLinks({ categories, pathname }: { categories: MenuCategory[]; pathname: string }) {
  if (!categories.length) return null;
  return <ul className="menu-category-links">
    {categories.map(category => {
      const href = `/catalog/${category.slug}`;
      return <li key={category.id}>
        <Link href={href} aria-current={href === pathname ? "page" : undefined}>{category.name}</Link>
        <CategoryLinks categories={category.children} pathname={pathname} />
      </li>;
    })}
  </ul>;
}
