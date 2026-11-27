import type { Metadata } from "next";
import { listingIndexState } from "@/features/catalog";
import { BrandScreen, brandSeoMetaDescription, brandSeoTitle, getBrandPage, requireBrand } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrandPage(slug);
  if (!brand) return { title: "Сторінку не знайдено", robots: null }; // Next.js adds noindex to the 404 itself
  const { page, filtered } = listingIndexState(sp);
  const paged = page > 1 && !filtered;
  return seoMetadata({
    title: brandSeoTitle(brand.name, paged ? page : 1),
    description: brandSeoMetaDescription(brand),
    path: paged ? `/brands/${slug}?page=${page}` : `/brands/${slug}`,
    ...(brand.logoUrl ? { images: [brand.logoUrl] } : {}),
    noIndex: filtered,
  });
}

// As for a category: the brand is looked up before anything streams, so a brand without a page answers a real 404.
export const unstable_paramMatching = { slug: "blocking" };
export const instant = false;

export default async function BrandPage({ params, searchParams }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const brand = await requireBrand(slug);
  return <BrandScreen brand={brand} searchParams={searchParams} />;
}
