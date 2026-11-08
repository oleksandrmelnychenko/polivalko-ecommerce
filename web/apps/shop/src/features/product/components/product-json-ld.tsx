import type { ProductDetails } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { productJsonLd } from "../lib/json-ld";

export function ProductJsonLd({ product }: { product: ProductDetails }) {
  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Каталог", path: "/catalog" },
          { name: product.category.name, path: `/catalog/${product.category.slug}` },
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
    </>
  );
}
