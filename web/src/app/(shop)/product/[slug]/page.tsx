import type { Metadata } from "next";
import { descriptionText } from "@/features/shop/product";
import { getProduct, ProductScreen } from "@/features/shop/product/server";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Товар не знайдено" };
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? (descriptionText(product.descriptionHtml) || undefined),
    alternates: { canonical: `/product/${product.slug}` },
  };
}

export default function ProductPage(props: PageProps<"/product/[slug]">) {
  return <ProductScreen {...props} />;
}
