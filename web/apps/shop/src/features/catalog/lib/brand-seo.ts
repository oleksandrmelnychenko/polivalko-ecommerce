import type { BrandPage } from "@polivalko/shared/api/types";
import { countProducts } from "@polivalko/shared/lib/format";
import { clip } from "@/shared/lib/clip";
import { introParagraphs } from "./category-intro";

const SNIPPET = 155;
const MIN_META_DESC = 120;

/** Clean 45–60 char brand page title (accounting for the " | Poli Valko" template suffix). */
export function brandSeoTitle(brandName: string, page = 1): string {
  const clean = brandName.trim();
  if (page > 1) {
    const rich = `${clean}: купити товари бренду — стор. ${page}`;
    if (rich.length >= 32 && rich.length <= 47) return rich;
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
    `${brand.name} у Poli Valko: ${countProducts(brand.productCount)} для поливу, саду й городу. Доставка Новою поштою по всій Україні та самовивіз у Бучі (ТК «Варшавський»).`,
    SNIPPET
  );
}

/** Ensures brand <meta name="description"> sits cleanly in 130–155 chars even when DB brand text is short (<120 chars). */
export function brandSeoMetaDescription(brand: Pick<BrandPage, "name" | "description" | "productCount">): string {
  const base = brandSeoDescription(brand).trim();
  if (base.length >= MIN_META_DESC && base.length <= SNIPPET) return base;
  if (base.length > SNIPPET) return clip(base, SNIPPET);

  const sentence = /[.!?]$/.test(base) ? base : `${base}.`;
  const count = countProducts(brand.productCount);
  const tails = [
    ` У каталозі Poli Valko — ${count}. Доставка Новою поштою по Україні та самовивіз у Бучі.`,
    ` ${count} у Poli Valko. Доставка Новою поштою по Україні та самовивіз у Бучі.`,
    " Доставка Новою поштою по Україні та самовивіз у Бучі (ТК «Варшавський»).",
    " Доставка Новою поштою по Україні та самовивіз у Бучі.",
    " Доставка по Україні та самовивіз у Бучі.",
    " Доставка по Україні й у Бучі.",
  ];

  for (const tail of tails) {
    const candidate = `${sentence}${tail}`;
    if (candidate.length >= 130 && candidate.length <= SNIPPET) return candidate;
  }
  for (const tail of tails) {
    const candidate = `${sentence}${tail}`;
    if (candidate.length >= MIN_META_DESC && candidate.length <= SNIPPET) return candidate;
  }
  return clip(`${sentence}${tails[2]}`, SNIPPET);
}
