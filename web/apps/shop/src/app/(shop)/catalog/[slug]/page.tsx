import type { Metadata } from "next";
import { categoryPhotoUrl, pageTitle } from "@/features/catalog";
import { CategoryScreen, getCategory } from "@/features/catalog/server";

export async function generateMetadata({ params, searchParams }: PageProps<"/catalog/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) return { title: "Розділ не знайдено" };
  const filtered = Object.keys(sp).length > 0;
  const image = categoryPhotoUrl(category);
  return {
    title: pageTitle(category.seoTitle || category.name),
    description: category.seoDescription ?? undefined,
    alternates: { canonical: `/catalog/${slug}` },
    openGraph: image ? { images: [image] } : undefined,
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function CategoryPage(props: PageProps<"/catalog/[slug]">) {
  return <CategoryScreen {...props} />;
}
