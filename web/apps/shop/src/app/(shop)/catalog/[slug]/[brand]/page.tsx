import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  categoryBrandSeoMeta,
  categoryPhotoUrl,
  duplicateSubcategoryRedirect,
  resolveCatalogRobotsAndCanonical,
  type SearchParams,
} from "@/features/catalog";
import {
  CategoryBrandScreen,
  getBrandPage,
  getBrandPages,
  getCategory,
  summarizeProducts,
} from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";
import { CategoryServiceLink } from "@/features/services/server";

type CategoryBrandPageProps = {
  params: Promise<{ slug: string; brand: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params, searchParams }: CategoryBrandPageProps): Promise<Metadata> {
  const [{ slug, brand }, sp] = await Promise.all([params, searchParams]);
  const duplicate = duplicateSubcategoryRedirect(slug, brand);
  if (duplicate) {
    return seoMetadata({
      title: "Перенаправлення",
      path: duplicate,
      noIndex: true,
    });
  }

  const [category, brandPage] = await Promise.all([getCategory(slug), getBrandPage(brand)]);
  if (!category || !brandPage) {
    return { title: "Сторінку не знайдено", robots: null };
  }

  const preview = await summarizeProducts({
    category: category.slug,
    brandPage: brandPage.slug,
  }).catch(() => null);
  const totalProducts = preview?.totalItems ?? 0;

  const decision = resolveCatalogRobotsAndCanonical({
    routeType: "category_brand",
    categorySlug: category.slug,
    brandSlug: brandPage.slug,
    searchParams: sp,
    totalProducts,
  });

  const meta = categoryBrandSeoMeta({
    categoryName: category.name,
    brandName: brandPage.name,
    productCount: totalProducts,
    page: decision.index ? decision.page : 1,
  });

  return seoMetadata({
    title: meta.title,
    description: meta.description,
    path: decision.canonicalPath,
    images: [brandPage.logoUrl, categoryPhotoUrl(category)],
    noIndex: !decision.index,
  });
}

export const unstable_paramMatching = { slug: "blocking", brand: "blocking" };
export const instant = false;

export default async function CategoryBrandPage({ params, searchParams }: CategoryBrandPageProps) {
  const { slug, brand } = await params;

  // Consolidate duplicates where a brand is already an L3 subcategory (e.g. /catalog/pidzemnyi-polyv/hunter -> /catalog/hunter)
  const duplicate = duplicateSubcategoryRedirect(slug, brand);
  if (duplicate) permanentRedirect(duplicate);

  const [category, brandPage, allBrands, categoryPreview] = await Promise.all([
    getCategory(slug),
    getBrandPage(brand),
    getBrandPages().catch(() => []),
    summarizeProducts({ category: slug }).catch(() => null),
  ]);

  if (!category || !brandPage) notFound();

  // Only link to brands that actually have products inside THIS category (prevents dead/thin internal links)
  const brandByLowerName = new Map(allBrands.map((b) => [b.name.trim().toLowerCase(), b]));
  const relatedBrands = (categoryPreview?.facets.brands ?? [])
    .map((facet) => {
      const matched = brandByLowerName.get(facet.name.trim().toLowerCase());
      if (!matched) return null;
      return {
        slug: matched.slug,
        name: matched.name,
        productCount: facet.count,
      };
    })
    .filter((item): item is { slug: string; name: string; productCount: number } => item !== null)
    .sort((a, b) => b.productCount - a.productCount);

  return (
    <CategoryBrandScreen
      category={category}
      brand={brandPage}
      searchParams={searchParams}
      relatedBrands={relatedBrands}
      after={<CategoryServiceLink slug={category.slug} ancestors={category.breadcrumbs} />}
    />
  );
}
