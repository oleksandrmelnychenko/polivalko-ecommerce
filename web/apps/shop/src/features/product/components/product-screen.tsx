import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { TrackViewItem } from "@/features/analytics";
import { resolveRedirect } from "@/features/catalog/server";
import { getProduct } from "../api/server";
import { Gallery } from "./gallery";
import { ProductBuybox } from "./product-buybox";
import { ProductDescription } from "./product-description";
import { ProductJsonLd } from "./product-json-ld";
import { RelatedProducts } from "./related-products";

type ProductScreenProps = { params: Promise<{ slug: string }> };

export function ProductScreen(props: ProductScreenProps) {
  return (
    <div className="container">
      <Suspense fallback={<div className="product"><div className="skeleton" style={{ aspectRatio: "1" }} /><div className="skeleton" style={{ height: "var(--space-4xl)" }} /></div>}>
        <ProductContent {...props} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: ProductScreenProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    const target = await resolveRedirect(`/product/${slug}`);
    if (target) permanentRedirect(target);
    notFound();
  }

  return (
    <>
      <ProductJsonLd product={product} />
      <TrackViewItem item={{ item_id: product.sku, item_name: product.name, price: Number(product.price.value), quantity: 1 }} />
      <nav className="crumbs product-crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/catalog">Каталог</Link>
          </li>
          <li>
            <Link href={`/catalog/${product.category.slug}`}>{product.category.name}</Link>
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="product">
        <Gallery images={product.images} name={product.name} />
        <ProductBuybox product={product} />
      </div>

      <ProductDescription product={product} />

      <Suspense fallback={null}>
        <RelatedProducts category={product.category.slug} exclude={product.id} />
      </Suspense>
    </>
  );
}
