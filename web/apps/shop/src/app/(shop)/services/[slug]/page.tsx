import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { seoMetadata } from "@/features/seo";
import { getServiceDirectionPage, ServicePageScreen } from "@/features/services/server";

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getServiceDirectionPage(slug);
  if (!page) return { title: "Сторінку не знайдено", robots: null }; // Next.js adds noindex to the 404 itself
  return seoMetadata({
    title: page.seoTitle || page.name,
    description: page.seoDescription || page.description,
    path: `/services/${page.slug}`,
    images: page.imageUrl ? [page.imageUrl] : [],
    // Without its own text the page is a stub: keep it out of search until the shop fills it in.
    noIndex: !page.bodyHtml,
  });
}

// A missing service answers a real 404 instead of the prebuilt shell with status 200 (see catalog/[slug]).
export const unstable_paramMatching = { slug: "blocking" };
export const instant = false;

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const page = await getServiceDirectionPage(slug);
  if (!page) notFound();
  return <ServicePageScreen page={page} />;
}
