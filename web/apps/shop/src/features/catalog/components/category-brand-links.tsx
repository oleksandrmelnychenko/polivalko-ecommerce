import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import type { BrandPage, Category } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import {
  categoryBrandHref,
  MIN_PRODUCTS_FOR_CATEGORY_BRAND,
  normalizeBrandSlug,
} from "../lib/category-brand-seo";
import type { SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { CategoryNavigation } from "./category-head";
import { ListingSkeleton } from "./listing-skeleton";

export interface CategoryBrandLinkItem {
  slug: string;
  name: string;
  productCount: number;
}

/**
 * Internal linking widget ("Популярні бренди в категорії") that links directly to clean,
 * indexable `/catalog/[slug]/[brand]` (or canonical L3 subcategory `/catalog/[brand]`) URLs
 * instead of noindex `?brand=...` filter query strings.
 */
type BrandLinksProps = {
  categorySlug: string;
  categoryName: string;
  brands: readonly CategoryBrandLinkItem[];
  currentBrandSlug?: string;
  minProducts?: number;
  maxItems?: number;
};

export function CategoryBrandLinks({
  categoryName,
  categorySlug,
  brands,
  currentBrandSlug,
  minProducts = MIN_PRODUCTS_FOR_CATEGORY_BRAND,
  maxItems = 10,
}: BrandLinksProps) {
  const current = currentBrandSlug ? normalizeBrandSlug(currentBrandSlug) : undefined;
  const links = brands
    .filter((brand) => brand.productCount >= minProducts && normalizeBrandSlug(brand.slug).length > 0)
    .slice(0, maxItems)
    .map((brand) => {
      const slug = normalizeBrandSlug(brand.slug);
      return (
        <li key={slug}>
          <Link href={categoryBrandHref(categorySlug, slug)} prefetch={false} aria-current={current === slug ? "page" : undefined}>
            {brand.name}
          </Link>
        </li>
      );
    });
  if (!links.length) return null;
  return (
    <nav aria-label={`Популярні бренди в категорії «${categoryName}»`} className="page-head__subs category-nav--brands">
      <span className="category-nav__label">Бренди</span>
      <ul className="chips chips--grey">{links}</ul>
    </nav>
  );
}

/**
 * Full storefront screen for clean Category × Brand SEO landing pages (`/catalog/[slug]/[brand]`).
 * Keeps brand filter locked in `base` while allowing shoppers to refine further (filtered combinations
 * are automatically marked `noindex, follow` with canonical to the clean Category × Brand URL).
 */
export function CategoryBrandScreen({
  category,
  brand,
  searchParams,
  relatedBrands = [],
  after,
}: {
  category: Category;
  brand: BrandPage;
  searchParams: Promise<SearchParams>;
  relatedBrands?: readonly CategoryBrandLinkItem[];
  after?: ReactNode;
}) {
  const basePath = `/catalog/${category.slug}/${brand.slug}`;
  const h1 = `${category.name} ${brand.name}`;
  const parents = [
    { name: "Каталог", path: "/catalog" },
    ...category.breadcrumbs.map((c) => ({ name: c.name, path: `/catalog/${c.slug}` })),
    { name: category.name, path: `/catalog/${category.slug}` },
  ];

  return (
    <div className="container catalog-page listing-page">
      <JsonLd data={breadcrumbJsonLd([...parents, { name: brand.name, path: basePath }])} />
      <Breadcrumbs current={brand.name} parents={parents} />

      <header className="page-head">
        <h1>{h1}</h1>
        <CategoryNavigation category={category} withinCategory />
        <CategoryBrandLinks
          categorySlug={category.slug}
          categoryName={category.name}
          brands={relatedBrands}
          currentBrandSlug={brand.slug}
        />
      </header>

      <Suspense fallback={<ListingSkeleton head={false} />}>
        <CategoryBrandListing
          category={category}
          brand={brand}
          basePath={basePath}
          searchParams={searchParams}
        />
      </Suspense>

      <div className="category-notes">
        <section className="category-intro" aria-labelledby="category-brand-about">
          <h2 id="category-brand-about">{h1} у Poli Valko</h2>
          <div className="category-intro__text">
            <p>
              У цьому розділі зібрано продукцію бренду {brand.name} з категорії «{category.name}».
              Замовляйте з доставкою Новою поштою по всій Україні або забирайте самовивозом у нашому
              магазині в Бучі (ТК «Варшавський», вул. Депутатська, 1-В).
            </p>
            <p>
              Переглянути весь розділ{" "}
              <Link href={`/catalog/${category.slug}`}>«{category.name}»</Link> або всі товари
              виробника <Link href={`/brands/${brand.slug}`}>{brand.name}</Link>.
            </p>
          </div>
        </section>
        {after}
      </div>
    </div>
  );
}

async function CategoryBrandListing({
  category,
  brand,
  basePath,
  searchParams,
}: {
  category: Category;
  brand: BrandPage;
  basePath: string;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <CatalogListing
      compact
      basePath={basePath}
      base={{ category: category.slug, brandPage: brand.slug }}
      searchParams={await searchParams}
      listName={`${category.name} ${brand.name}`}
      emptyHint={`Товарів ${brand.name} у категорії «${category.name}» зараз немає в продажу.`}
    />
  );
}
