import { Suspense, type ReactNode } from "react";
import type { Category } from "@polivalko/shared/api/types";
import { getBrandPages, summarizeProducts } from "../api/server";
import { categoryBrandHref } from "../lib/category-brand-seo";
import { listingIndexState, type SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { CategoryBrandLinks } from "./category-brand-links";
import { CategoryHead } from "./category-head";
import { FirstPageIntro } from "./category-intro";
import { ListingSkeleton } from "./listing-skeleton";

type CategoryScreenProps = { category: Category; searchParams: Promise<SearchParams> };

/** Optional companion to the category description, such as a related service. */
type CategoryScreenSlots = { after?: ReactNode };

/** The page resolves the category first (see requireCategory), so a missing one is a real 404. */
export function CategoryScreen({ category, searchParams, after }: CategoryScreenProps & CategoryScreenSlots) {
  return (
    <div className="container catalog-page listing-page">
      <CategoryHead category={category}>
        <Suspense fallback={null}>
          <CategoryPopularBrands category={category} searchParams={searchParams} />
        </Suspense>
      </CategoryHead>
      <Suspense fallback={<ListingSkeleton head={false} />}>
        <CategoryListing category={category} searchParams={searchParams} />
      </Suspense>
      <div className="category-notes">
        <FirstPageIntro name={category.name} description={category.description} isSubcategory={category.breadcrumbs.length > 0} searchParams={searchParams} />
        {after}
      </div>
    </div>
  );
}

/**
 * Renders clean internal links ("Популярні бренди в категорії") to indexable `/catalog/[slug]/[brand]`
 * landing pages on unfiltered page 1, scoped strictly to brands with real products in this category.
 */
async function CategoryPopularBrands({ category, searchParams }: CategoryScreenProps) {
  const { page, filtered } = listingIndexState(await searchParams);
  if (page > 1 || filtered) return null;

  const [allBrands, preview] = await Promise.all([
    getBrandPages().catch(() => []),
    summarizeProducts({ category: category.slug }).catch(() => null),
  ]);
  if (allBrands.length === 0 || !preview?.facets.brands.length) return null;

  const brandByLowerName = new Map(allBrands.map((b) => [b.name.trim().toLowerCase(), b]));
  const currentPath = `/catalog/${category.slug}`;
  const seen = new Set<string>();
  const brands = preview.facets.brands
    .map((facet) => {
      const matched = brandByLowerName.get(facet.name.trim().toLowerCase());
      if (!matched || seen.has(matched.slug)) return null;
      // Avoid self-linking when the category itself is already the brand's L3 subcategory (e.g. /catalog/hunter).
      if (categoryBrandHref(category.slug, matched.slug) === currentPath) return null;
      seen.add(matched.slug);
      return {
        slug: matched.slug,
        name: matched.name,
        productCount: facet.count,
      };
    })
    .filter((item): item is { slug: string; name: string; productCount: number } => item !== null)
    .sort((a, b) => b.productCount - a.productCount);

  return (
    <CategoryBrandLinks
      categoryName={category.name}
      categorySlug={category.slug}
      brands={brands}
    />
  );
}

async function CategoryListing({ category, searchParams }: CategoryScreenProps) {
  return (
    <CatalogListing
      compact
      basePath={`/catalog/${category.slug}`}
      base={{ category: category.slug }}
      searchParams={await searchParams}
      listName={category.name}
      emptyHint="У цьому розділі поки немає товарів. Перегляньте інші категорії."
    />
  );
}
