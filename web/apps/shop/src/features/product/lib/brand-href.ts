import type { ProductDetails } from "@polivalko/shared/api/types";

/** The brand page when the brand has one, otherwise the catalog filtered by the brand. */
export function brandHref(product: Pick<ProductDetails, "brand" | "brandSlug">): string {
  return product.brandSlug ? `/brands/${product.brandSlug}` : `/catalog?brand=${encodeURIComponent(product.brand ?? "")}`;
}
