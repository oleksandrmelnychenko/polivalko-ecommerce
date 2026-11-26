import type { ProductDetails } from "@polivalko/shared/api/types";
import type { SeoInput } from "@/features/seo";
import { hasShopName } from "@/shared/lib/page-title";
import { descriptionText } from "./description";
import { isIndexableProduct } from "./indexable";

// Rendered <title> appends " | Poli Valko" (+13 chars) unless the shop name is already present.
const MAX_TITLE_WITH_BRAND = 65;
const MAX_TITLE_WITHOUT_BRAND = 52;
const MIN_TITLE_WITHOUT_BRAND = 32;

const SHOP_SUFFIX_RE = /\s*[|—–-]\s*poli\s*valko[\s.!?»"')]*$/i;
const BUY_TAIL_RE = /\s*[,:;—–-]\s*купити(?:\s+з\s+доставкою|\s+в\s+україні|\s+в\s+бучі)?\s*$/i;
const PRICE_TAIL_RE = /\s*[,:;—–-]\s*ціна\s+[\d\s,.]+грн\s*$/i;
const DANGLING_TAIL_RE = /\s+(в|у|з|із|зі|та|і|й|на|до|від|для|по|за|під|над|при|про|без)$/i;

function formatUah(rawValue: string | number | null | undefined): string | null {
  const num = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(num) || num <= 0) return null;
  const rounded = Math.round(num);
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} грн`;
}

function clipTitleCleanly(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen + 1);
  const lastSpace = slice.lastIndexOf(" ");
  let cut = lastSpace > Math.floor(maxLen * 0.55) ? slice.slice(0, lastSpace) : clean.slice(0, maxLen);
  cut = cut.replace(/[\s.,;:—–\-/(«"]+$/g, "").trim();
  while (DANGLING_TAIL_RE.test(cut)) {
    cut = cut.replace(DANGLING_TAIL_RE, "").replace(/[\s.,;:—–\-/(«"]+$/g, "").trim();
  }
  return cut;
}

/**
 * Keeps product titles within ~55–65 rendered characters (accounting for the " | Poli Valko" suffix)
 * while preserving well-formed explicit CMS titles unchanged.
 */
export function formatProductTitle(
  product: Pick<ProductDetails, "name" | "brand" | "price" | "seoTitle">
): string {
  const explicit = product.seoTitle?.trim() || "";
  const raw = (explicit || product.name).replace(/\s+/g, " ").trim();
  const hasBrand = hasShopName(raw);
  const maxLen = hasBrand ? MAX_TITLE_WITH_BRAND : MAX_TITLE_WITHOUT_BRAND;

  // Preserve well-sized explicit CMS titles unchanged; enrich short raw product names when seoTitle is absent.
  if (raw.length <= maxLen) {
    if (!explicit && raw.length < MIN_TITLE_WITHOUT_BRAND && !hasBrand) {
      const price = formatUah(product.price?.value);
      const candidates = [
        price ? `${raw} — купити за ${price}` : null,
        price ? `${raw} — ${price}` : null,
        `${raw} — купити в Україні`,
        `${raw} — купити`,
      ].filter((c): c is string => Boolean(c));
      for (const candidate of candidates) {
        if (candidate.length >= MIN_TITLE_WITHOUT_BRAND && candidate.length <= MAX_TITLE_WITHOUT_BRAND) {
          return candidate;
        }
      }
    }
    return raw;
  }

  // Separate optional brand suffix so trimming boilerplate leaves brand consistency intact.
  const brandMatch = hasBrand ? raw.match(SHOP_SUFFIX_RE) : null;
  const suffix = brandMatch ? brandMatch[0] : "";
  const bodyBudget = maxLen - suffix.length;
  let body = suffix ? raw.slice(0, raw.length - suffix.length).trim() : raw;

  // Step 1: Drop redundant "купити з доставкою" boilerplate first.
  const withoutBuy = body.replace(BUY_TAIL_RE, "").trim();
  if (withoutBuy.length > 0 && withoutBuy.length <= bodyBudget) {
    return `${withoutBuy}${suffix}`;
  }
  body = withoutBuy || body;

  // Step 2: Drop trailing price clause if still too long.
  const withoutPrice = body.replace(PRICE_TAIL_RE, "").trim();
  if (withoutPrice.length > 0 && withoutPrice.length <= bodyBudget) {
    return `${withoutPrice}${suffix}`;
  }
  body = withoutPrice || body;

  // Step 3: Fall back to clean product name if it fits.
  const cleanName = product.name.replace(/\s+/g, " ").trim();
  if (cleanName.length > 0 && cleanName.length <= bodyBudget) {
    return `${cleanName}${suffix}`;
  }

  // Step 4: Word-boundary clip with no dangling prepositions or punctuation.
  return `${clipTitleCleanly(body, bodyBudget)}${suffix}`;
}

/** What the product page tells search engines; a thin page (see isIndexableProduct) is noindex, follow. */
export function productSeo(product: ProductDetails): SeoInput {
  return {
    title: formatProductTitle(product),
    description: product.seoDescription ?? descriptionText(product.descriptionHtml),
    path: `/product/${product.slug}`,
    images: product.images.slice(0, 4).map((image) => image.url),
    noIndex: !isIndexableProduct(product),
  };
}
