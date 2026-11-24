import type { ProductDetails } from "@polivalko/shared/api/types";

export function brandHref(product: ProductDetails): string {
  return `/catalog?brand=${encodeURIComponent(product.brand ?? "")}`;
}
