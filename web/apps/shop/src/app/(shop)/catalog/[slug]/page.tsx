import type { Metadata } from "next";
import { categoryPhotoUrl } from "@/features/catalog";
import { CategoryScreen, getCategory, requireCategory } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

function listingState(sp: Record<string, string | string[] | undefined>) {
  const keys = Object.keys(sp).filter((key) => sp[key] !== undefined && sp[key] !== "");
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const paged = keys.length === 1 && keys[0] === "page" && Number.isInteger(page) && page > 1;
  return { page: paged ? page : 1, filtered: keys.length > 0 && !paged };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/catalog/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) return { title: "Сторінку не знайдено", robots: null }; // Next.js adds noindex to the 404 itself
  const { page, filtered } = listingState(sp);
  return seoMetadata({
    title: page > 1 ? `${category.name}, сторінка ${page}` : category.seoTitle || category.name,
    description: category.seoDescription,
    path: page > 1 ? `/catalog/${slug}?page=${page}` : `/catalog/${slug}`,
    images: [categoryPhotoUrl(category)],
    noIndex: filtered,
  });
}

// The category is looked up before anything streams, so a missing one answers a real 404 and an old address 308.
// "blocking": an unknown slug waits for this render instead of getting the prebuilt shell with status 200.
// The lookup is cached ("use cache"), so the wait is short; the product listing still streams behind Suspense.
export const unstable_paramMatching = { slug: "blocking" };
export const instant = false;

export default async function CategoryPage({ params, searchParams }: PageProps<"/catalog/[slug]">) {
  const { slug } = await params;
  return <CategoryScreen category={await requireCategory(slug)} searchParams={searchParams} />;
}
