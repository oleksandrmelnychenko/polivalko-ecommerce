import type { Breadcrumb } from "@/shared/ui/breadcrumbs";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { hasPrice } from "@/shared/lib/price";
import { productJsonLd } from "../lib/json-ld";

export function ProductJsonLd({ product, parents }: { product: ProductDetails; parents: Breadcrumb[] }) {
  return (
    <>
      {/* Google reads Product markup without an offer as an error in the product snippets report; a product without a
          price has no offer, so it gets only the breadcrumbs. */}
      {hasPrice(product.price) ? <JsonLd data={productJsonLd(product)} /> : null}
      <JsonLd
        data={breadcrumbJsonLd([
          ...parents,
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
    </>
  );
}
