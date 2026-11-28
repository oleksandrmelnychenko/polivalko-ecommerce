import { plainText } from "@polivalko/shared/lib/format";

export const MODEL_ATTRIBUTE = "модель виробника";
const BRAND_ATTRIBUTES = new Set(["бренд", "виробник", "торгова марка"]);

export type BrandAttribute = { name: string; value: string };
export type BrandSource = {
  brand?: string | null;
  name: string;
  descriptionHtml?: string | null;
  attributes: readonly BrandAttribute[];
};

export type AliasRule = { brand: string; patterns: readonly RegExp[] };

// Verified direct brand/manufacturer aliases present in catalog titles and descriptions.
export const DIRECT_BRAND_ALIASES: readonly AliasRule[] = [
  { brand: "Сімейний Сад", patterns: [/(?:^|[^\p{L}\d])сімейний\s+сад(?=$|[^\p{L}\d])/iu] },
  { brand: "Proventus", patterns: [/(?:^|[^\p{L}\d])провентус(?=$|[^\p{L}\d])/iu] },
  { brand: "Lamela", patterns: [/(?:^|[^\p{L}\d])лмл(?=$|[^\p{L}\d])/iu] },
  { brand: "Fiskars", patterns: [/(?:^|[^\p{L}\d])fiskars(?:xpert)?(?=$|[^\p{L}\d])/iu] },
  { brand: "REHAU", patterns: [/(?:^|[^\p{L}\d])rehau(?=$|[^\p{L}\d])/iu] },
  { brand: "DOLONI", patterns: [/(?:^|[^\p{L}\d])(?:doloni|долоні)(?=$|[^\p{L}\d])/iu] },
  { brand: "ММ-Пласт", patterns: [/(?:^|[^\p{L}\d])мм-?пласт(?=$|[^\p{L}\d])/iu] },
  { brand: "Hilfmann", patterns: [/(?:^|[^\p{L}\d])hilfmann?(?=$|[^\p{L}\d])/iu] },
  { brand: "Water World Window", patterns: [/(?:^|[^\p{L}\d])water\s+world\s+window(?=$|[^\p{L}\d])/iu] },
  { brand: "DLF", patterns: [/(?:^|[^\p{L}\d])dlf(?:\s+turfline)?(?=$|[^\p{L}\d])/iu] },
  { brand: "Siarkopol", patterns: [/(?:^|[^\p{L}\d])siarkopol(?=$|[^\p{L}\d])/iu] },
  { brand: "Bonomi", patterns: [/(?:^|[^\p{L}\d])bonomi(?=$|[^\p{L}\d])/iu] },
  { brand: "БТУ-Центр", patterns: [/(?:^|[^\p{L}\d])біофренд(?=$|[^\p{L}\d])/iu] },
  { brand: "Кіссон", patterns: [/(?:^|[^\p{L}\d])флорін(?=$|[^\p{L}\d])/iu] },
];

// Own-brand title marker for house-packed items (checked in title only so store promo copy in descriptions never matches).
export const HOUSE_BRAND_TITLE_PATTERN = /(?:^|[^\p{L}\d])poli-?valko(?=$|[^\p{L}\d])/iu;

// Registered agrochemical/fertilizer product lines that map to a single manufacturer.
// Applied only to the matching item and never propagated over Ukrainian repacker GTIN prefixes.
export const PRODUCT_LINE_ALIASES: readonly AliasRule[] = [
  { brand: "Yara", patterns: [/(?:^|[^\p{L}\d])(?:яраміла|яравера|yaramila|yaravera)(?=$|[^\p{L}\d])/iu] },
  { brand: "Protect Garden", patterns: [/(?:^|[^\p{L}\d])(?:магнікур|прованто|блу\s+бордо)(?=$|[^\p{L}\d])/iu] },
  { brand: "Syngenta", patterns: [/(?:^|[^\p{L}\d])(?:ізабіон|хорус|міравіс|ураган\s+форте)(?=$|[^\p{L}\d])/iu] },
  { brand: "Valagro", patterns: [/(?:^|[^\p{L}\d])(?:брексил|радіфарм|плантафол|мегафол|кендал)(?=$|[^\p{L}\d])/iu] },
  { brand: "Bayer", patterns: [/(?:^|[^\p{L}\d])(?:превікур|фалькон)(?=$|[^\p{L}\d])/iu] },
  { brand: "BASF", patterns: [/(?:^|[^\p{L}\d])(?:сігнум|бі-58)(?=$|[^\p{L}\d])/iu] },
];

export function matchBrandAliases(rules: readonly AliasRule[], text: string): string | undefined {
  if (!text) return undefined;
  return rules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)))?.brand;
}

export function extractBrandAttribute(attributes: readonly BrandAttribute[]): string | undefined {
  const value = attributes
    .find((attribute) => BRAND_ATTRIBUTES.has(attribute.name.trim().toLowerCase()))
    ?.value.trim();
  return value || undefined;
}

export function extractProductModel(attributes: readonly BrandAttribute[]): string | undefined {
  const value = attributes
    .find((attribute) => attribute.name.trim().toLowerCase() === MODEL_ATTRIBUTE)
    ?.value.trim();
  return value || undefined;
}

/** Resolves a product's brand from its explicit field, attributes, or verified title/description brand aliases. */
export function resolveProductBrand(product: BrandSource): string | undefined {
  const explicit = product.brand?.trim();
  if (explicit) return explicit;

  const fromAttribute = extractBrandAttribute(product.attributes);
  if (fromAttribute) return fromAttribute;

  const title = product.name.trim();
  const description = plainText(product.descriptionHtml).join(" ");

  const direct =
    matchBrandAliases(DIRECT_BRAND_ALIASES, title) ??
    matchBrandAliases(DIRECT_BRAND_ALIASES, description);
  if (direct) return direct;

  if (HOUSE_BRAND_TITLE_PATTERN.test(title)) return "Poli Valko";

  return (
    matchBrandAliases(PRODUCT_LINE_ALIASES, title) ??
    matchBrandAliases(PRODUCT_LINE_ALIASES, description)
  );
}
