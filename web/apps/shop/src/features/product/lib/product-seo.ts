import type { ProductDetails } from "@polivalko/shared/api/types";
import type { SeoInput } from "@/features/seo";
import { descriptionText } from "./description";
import { isIndexableProduct } from "./indexable";

/** What the product page tells search engines; a thin page (see isIndexableProduct) is noindex, follow. */
export function productSeo(product: ProductDetails): SeoInput {
  return {
    title: product.seoTitle || product.name,
    description: product.seoDescription ?? descriptionText(product.descriptionHtml),
    path: `/product/${product.slug}`,
    images: product.images.slice(0, 4).map((image) => image.url),
    noIndex: !isIndexableProduct(product),
  };
}
