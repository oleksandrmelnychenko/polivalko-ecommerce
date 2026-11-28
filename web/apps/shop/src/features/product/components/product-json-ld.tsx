import { cacheLife } from "next/cache";
import type { Breadcrumb } from "@/shared/ui/breadcrumbs";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { breadcrumbJsonLd, computeOfferValidFrom, computePriceValidUntil, JsonLd } from "@/features/seo";
import { hasPrice } from "@/shared/lib/price";
import { productJsonLd, type ProductJsonLdOptions } from "../lib/json-ld";

async function cachedOfferDates(): Promise<{ validFrom: string; priceValidUntil: string }> {
  "use cache";
  cacheLife("days");
  const now = new Date();
  return {
    validFrom: computeOfferValidFrom(now),
    priceValidUntil: computePriceValidUntil(now),
  };
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
  const offerDates = hasPrice(product.price) ? await cachedOfferDates() : undefined;
  return (
    <>
      {/* Google reads Product markup without an offer as an error in the product snippets report; a product without a
          price has no offer, so it gets only the breadcrumbs. */}
      {hasPrice(product.price) ? (
        <JsonLd
          data={productJsonLd(product, {
            validFrom: offerDates?.validFrom,
            priceValidUntil: offerDates?.priceValidUntil,
            aggregateRating,
            reviews,
          })}
        />
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
