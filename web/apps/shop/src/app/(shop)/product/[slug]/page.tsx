import type { Metadata } from "next";
import { descriptionText } from "@/features/product";
import { getProduct, ProductScreen, requireProduct } from "@/features/product/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Сторінку не знайдено", robots: null }; // Next.js adds noindex to the 404 itself
  return seoMetadata({
    title: product.seoTitle || product.name,
    description: product.seoDescription ?? descriptionText(product.descriptionHtml),
    path: `/product/${product.slug}`,
    images: product.images.slice(0, 4).map((image) => image.url),
  });
}

// The product is looked up before anything streams, so a missing one answers a real 404 and an old address 308.
// "blocking": an unknown slug waits for this render instead of getting the prebuilt shell with status 200.
// The lookup is cached ("use cache"), so the wait is short; related products still stream.
export const unstable_paramMatching = { slug: "blocking" };
export const instant = false;

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  return <ProductScreen product={await requireProduct(slug)} />;
}
