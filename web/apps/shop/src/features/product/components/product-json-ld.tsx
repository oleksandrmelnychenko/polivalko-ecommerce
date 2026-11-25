import type { Breadcrumb } from "@/shared/ui/breadcrumbs";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { productJsonLd } from "../lib/json-ld";

export function ProductJsonLd({ product, parents }: { product: ProductDetails; parents: Breadcrumb[] }) {
  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          ...parents,
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
    </>
  );
}
