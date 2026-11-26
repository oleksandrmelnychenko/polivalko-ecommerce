import type { ProductDetails } from "@polivalko/shared/api/types";
import { plainText } from "@polivalko/shared/lib/format";

/** Text no longer than `max` characters: a longer one is cut at a word boundary and marked with an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const lastSpace = head.lastIndexOf(" ");
  // A space only near the start means one very long word: cutting there would leave almost nothing.
  const cut = lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head;
  return `${cut.replace(/[\s.,;:–—-]+$/, "")}…`;
}

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
