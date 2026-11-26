import type { BrandPage } from "@polivalko/shared/api/types";
import { countProducts } from "@polivalko/shared/lib/format";
import { clip } from "@/shared/lib/clip";
import { introParagraphs } from "./category-intro";

const SNIPPET = 160;

/** The brand's own first paragraph when there is one, otherwise a line with what the shop has of the brand. */
export function brandSeoDescription(brand: Pick<BrandPage, "name" | "description" | "productCount">): string {
  const own = introParagraphs(brand.description)[0];
  if (own) return clip(own, SNIPPET);
  return clip(`${brand.name} у Poli Valko: ${countProducts(brand.productCount)} з доставкою Новою поштою по Україні або самовивозом з магазину.`, SNIPPET);
}
