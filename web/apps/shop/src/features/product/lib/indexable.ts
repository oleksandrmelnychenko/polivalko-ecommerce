import type { ProductDetails } from "@polivalko/shared/api/types";

/**
 * Whether the product page is offered to search engines: it has a photo. A product without one is shown on the site
 * but stays out of search until it gets a photo. Neither stock nor price matters, so a page does not drop out of the
 * index when the product sells out or waits for a price. The API applies the same rule to the sitemap
 * (GetSitemap.cs), so the two agree once the cached sitemap refreshes.
 */
export function isIndexableProduct(product: Pick<ProductDetails, "images">): boolean {
  return product.images.length > 0;
}
