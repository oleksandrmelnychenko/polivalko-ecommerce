import Link from "next/link";
import { Suspense } from "react";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { TrackViewItem } from "@/features/analytics";
import { Gallery } from "./gallery";
import { ProductBuybox } from "./product-buybox";
import { ProductDescription } from "./product-description";
import { ProductJsonLd } from "./product-json-ld";
import { RelatedProducts } from "./related-products";

/** The page resolves the product first (see requireProduct), so a missing one is a real 404. */
export function ProductScreen({ product }: { product: ProductDetails }) {
  return (
    <div className="container">
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
    </div>
  );
}
