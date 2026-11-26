import { cacheLife } from "next/cache";
import type { Breadcrumb } from "@/shared/ui/breadcrumbs";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, computePriceValidUntil, JsonLd } from "@/features/seo";
import { hasPrice } from "@/shared/lib/price";
import { productJsonLd, type ProductJsonLdOptions } from "../lib/json-ld";

async function cachedPriceValidUntil(): Promise<string> {
  "use cache";
  cacheLife("days");
  return computePriceValidUntil(new Date());
}

export async function ProductJsonLd({
  product,
  parents,
  aggregateRating,
  reviews,
}: {
  product: ProductDetails;
  parents: Breadcrumb[];
  aggregateRating?: ProductJsonLdOptions["aggregateRating"];
  reviews?: ProductJsonLdOptions["reviews"];
}) {
  const priceValidUntil = hasPrice(product.price) ? await cachedPriceValidUntil() : undefined;
  return (
    <>
      {/* Google reads Product markup without an offer as an error in the product snippets report; a product without a
          price has no offer, so it gets only the breadcrumbs. */}
      {hasPrice(product.price) ? (
        <JsonLd data={productJsonLd(product, { priceValidUntil, aggregateRating, reviews })} />
      ) : null}
      <JsonLd
        data={breadcrumbJsonLd([
          ...parents,
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
    </>
  );
}
