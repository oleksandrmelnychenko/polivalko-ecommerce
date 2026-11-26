import type { ProductDetails } from "@polivalko/shared/api/types";
import { plainText } from "@polivalko/shared/lib/format";
import { clip } from "@/shared/lib/clip";

export { clip };

/** The product's own text as one line, short enough for a meta description. */
export function descriptionText(html: string | null | undefined): string {
  return clip(plainText(html).join(" "), 160);
}

/**
 * The description for structured data: the product's own text in full (search engines read up to 5,000 characters),
 * otherwise the SEO description, which is usually the shop-wide template.
 */
export function markupDescription(product: Pick<ProductDetails, "descriptionHtml" | "seoDescription">): string | undefined {
  return clip(plainText(product.descriptionHtml).join(" "), 5000) || product.seoDescription?.trim() || undefined;
}
