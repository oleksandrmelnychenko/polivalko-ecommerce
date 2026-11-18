import type { ProductDetails } from "@polivalko/shared/api/types";

export function brandHref(product: ProductDetails): string {
  return `/catalog/${product.category.slug}?brand=${encodeURIComponent(product.brand ?? "")}`;
}
