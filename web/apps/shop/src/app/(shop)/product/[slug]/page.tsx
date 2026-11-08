import type { Metadata } from "next";
import { descriptionText } from "@/features/product";
import { getProduct, ProductScreen } from "@/features/product/server";
import { seoMetadata } from "@/features/seo";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Товар не знайдено" };
  return seoMetadata({
    title: product.seoTitle || product.name,
    description: product.seoDescription ?? descriptionText(product.descriptionHtml),
    path: `/product/${product.slug}`,
    images: product.images.slice(0, 4).map((image) => image.url),
  });
}

export default function ProductPage(props: PageProps<"/product/[slug]">) {
  return <ProductScreen {...props} />;
}
