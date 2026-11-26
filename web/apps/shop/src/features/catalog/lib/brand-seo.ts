import type { BrandPage } from "@polivalko/shared/api/types";
import { countProducts } from "@polivalko/shared/lib/format";
import { clip } from "@/shared/lib/clip";
import { introParagraphs } from "./category-intro";

const SNIPPET = 155;

/** Clean 45–60 char brand page title (accounting for the " | Poli Valko" template suffix). */
export function brandSeoTitle(brandName: string, page = 1): string {
  const clean = brandName.trim();
  if (page > 1) {
    const paged = `${clean}: товари бренду — стор. ${page}`;
    return paged.length <= 52 ? paged : clip(`${clean} — стор. ${page}`, 52);
  }
  const full = `${clean} — купити товари бренду в Україні`;
  if (full.length <= 47) return full;
  const medium = `${clean} — товари для саду й поливу`;
  if (medium.length <= 47) return medium;
  return clip(`${clean} — каталог товарів`, 47);
}

/** The brand's own first paragraph when there is one, otherwise a 130–155 char line with what the shop has of the brand. */
export function brandSeoDescription(brand: Pick<BrandPage, "name" | "description" | "productCount">): string {
  const own = introParagraphs(brand.description)[0];
  if (own) return clip(own, SNIPPET);
  return clip(
    `${brand.name} у Poli Valko: ${countProducts(brand.productCount)} для поливу, саду й городу. Доставка Новою поштою по Україні та самовивіз у Бучі (ТК «Варшавський»).`,
    SNIPPET
  );
}
