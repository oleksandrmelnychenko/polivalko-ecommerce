import type { Metadata } from "next";
import { categoryPhotoUrl } from "@/features/catalog";
import { CategoryScreen, getCategory } from "@/features/catalog/server";
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
  if (!category) return { title: "Розділ не знайдено" };
  const { page, filtered } = listingState(sp);
  return seoMetadata({
    title: page > 1 ? `${category.name}, сторінка ${page}` : category.seoTitle || category.name,
    description: category.seoDescription,
    path: page > 1 ? `/catalog/${slug}?page=${page}` : `/catalog/${slug}`,
    images: [categoryPhotoUrl(category)],
    noIndex: filtered,
  });
}

export default function CategoryPage(props: PageProps<"/catalog/[slug]">) {
  return <CategoryScreen {...props} />;
}
