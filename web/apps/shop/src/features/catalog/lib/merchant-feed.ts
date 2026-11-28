import type { MerchantFeedItem } from "@polivalko/shared/api/types";
import { plainText } from "@polivalko/shared/lib/format";
import { gtinFromAttributes } from "@polivalko/shared/lib/gtin";
import { clip } from "@/shared/lib/clip";
import { googleProductCategoryFromPath } from "@/shared/lib/google-product-taxonomy";
import {
  DIRECT_BRAND_ALIASES,
  extractBrandAttribute,
  extractProductModel,
  HOUSE_BRAND_TITLE_PATTERN,
  matchBrandAliases,
  PRODUCT_LINE_ALIASES,
} from "@/shared/lib/product-brand";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const EXTRA_IMAGES = 10;
const MIN_INFERRED_BRAND_LENGTH = 3;
// Generic product-line names that exist as DB brands but should not win over manufacturer names in descriptions.
const SKIP_DESCRIPTION_BRANDS = new Set(["супер добриво"]);

type BrandMatcher = { name: string; folded: string; pattern: RegExp };

function foldText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBrandMatchers(items: readonly MerchantFeedItem[]): BrandMatcher[] {
  const unique = new Set<string>();
  for (const item of items) {
    const b = item.brand?.trim();
    if (b && b.length >= MIN_INFERRED_BRAND_LENGTH) unique.add(b);
  }
  return Array.from(unique)
    .sort((a, b) => b.length - a.length)
    .map((name) => {
      const folded = foldText(name);
      return {
        name,
        folded,
        pattern: new RegExp(`(?:^|[^\\p{L}\\d])${escapeRegExp(folded)}(?=$|[^\\p{L}\\d])`, "iu"),
      };
    });
}

/**
 * GS1 company prefix for EAN-13 barcodes:
 * - Ukrainian GS1 (482) uses 9-digit company allocations, preventing cross-company collisions within 4820xxx.
 * - International GS1 prefixes (EU/TR/PL/FI/etc.) are scoped to 7 digits.
 */
function gs1CompanyPrefix(gtin: string | undefined): string | undefined {
  if (!gtin || gtin.length !== 13) return undefined;
  return gtin.startsWith("482") ? gtin.slice(0, 9) : gtin.slice(0, 7);
}

/**
 * Resolves brands across the catalog in two deterministic passes:
 * 1) Explicit DB brand, manufacturer attributes, direct brand mentions in title/description, and product-line aliases.
 * 2) Unambiguous GS1 EAN-13 company prefix propagation built exclusively from direct manufacturer brands
 *    (any prefix shared by 2+ brands is automatically ignored).
 */
function resolveBrands(items: readonly MerchantFeedItem[]): Map<string, string> {
  const matchers = buildBrandMatchers(items);
  const directBrands = new Map<string, string>();
  const resolved = new Map<string, string>();
  const gtins = new Map<string, string | undefined>();

  for (const item of items) {
    gtins.set(item.id, gtinFromAttributes(item.attributes)?.value);
    const explicit = item.brand?.trim();
    if (explicit) {
      directBrands.set(item.id, explicit);
      resolved.set(item.id, explicit);
      continue;
    }

    const fromAttribute = extractBrandAttribute(item.attributes);
    if (fromAttribute) {
      directBrands.set(item.id, fromAttribute);
      resolved.set(item.id, fromAttribute);
      continue;
    }

    const title = item.name.trim();
    const foldedTitle = foldText(title);
    const description = plainText(item.descriptionHtml).join(" ");
    const foldedDescription = foldText(description);

    const direct =
      matchBrandAliases(DIRECT_BRAND_ALIASES, title) ??
      matchers.find((matcher) => matcher.pattern.test(foldedTitle))?.name ??
      matchBrandAliases(DIRECT_BRAND_ALIASES, description) ??
      matchers.find((matcher) => !SKIP_DESCRIPTION_BRANDS.has(matcher.folded) && matcher.pattern.test(foldedDescription))?.name;
    if (direct) {
      directBrands.set(item.id, direct);
      resolved.set(item.id, direct);
      continue;
    }

    if (HOUSE_BRAND_TITLE_PATTERN.test(title)) {
      resolved.set(item.id, "Poli Valko");
      continue;
    }

    const fromProductLine =
      matchBrandAliases(PRODUCT_LINE_ALIASES, title) ??
      matchBrandAliases(PRODUCT_LINE_ALIASES, description);
    if (fromProductLine) {
      resolved.set(item.id, fromProductLine);
    }
  }

  const prefixBrands = new Map<string, Set<string>>();
  for (const item of items) {
    const brand = directBrands.get(item.id);
    const prefix = gs1CompanyPrefix(gtins.get(item.id));
    if (!brand || !prefix) continue;
    let set = prefixBrands.get(prefix);
    if (!set) {
      set = new Set();
      prefixBrands.set(prefix, set);
    }
    set.add(brand);
  }

  const unambiguousPrefixes = new Map<string, string>();
  for (const [prefix, set] of prefixBrands) {
    if (set.size === 1) {
      const [onlyBrand] = set;
      if (onlyBrand) unambiguousPrefixes.set(prefix, onlyBrand);
    }
  }

  for (const item of items) {
    if (resolved.has(item.id)) continue;
    const prefix = gs1CompanyPrefix(gtins.get(item.id));
    const inferred = prefix ? unambiguousPrefixes.get(prefix) : undefined;
    if (inferred) resolved.set(item.id, inferred);
  }

  return resolved;
}

// Google Merchant Center prohibits tobacco/smoking items (while garden pest-control "тютюновий пил" stays allowed)
// and also auto-flags glass-ampoule dimethoate "Бі-58" under its prohibited drugs policy.
const PROHIBITED_GMC_ITEMS_PATTERN =
  /(?:^|[^\p{L}\d])(?:тютюн\s+курильн\p{L}*|курильн\p{L}*\s+тютюн\p{L}*|табак\s+курительн\p{L}*|махорк\p{L}*|сигарет\p{L}*|сигар\p{L}*|кальян\p{L}*|вейп\p{L}*|smoking\s+tobacco|(?:бі|би|bi)[\s-]?58)(?=$|[^\p{L}\d])/iu;

export function isMerchantFeedEligible(item: Pick<MerchantFeedItem, "name" | "slug">): boolean {
  const text = `${item.name} ${item.slug.replace(/-/g, " ")}`;
  return !PROHIBITED_GMC_ITEMS_PATTERN.test(text);
}

export type FeedShop = { url: string; name: string; description: string };

/** Text safe inside an XML element: markup characters are escaped and control characters, which break a parser, dropped. */
function xml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tag(name: string, value: string | null | undefined): string {
  return value ? `<${name}>${xml(value)}</${name}>` : "";
}

const amount = (money: { value: string; currency: string }) => `${money.value} ${money.currency}`;

/**
 * The feed id of every product: its article number. Should one ever repeat, the product with the smallest id keeps
 * it and the others go by their own id, so the ids a shopping service already knows do not depend on list order.
 */
function feedIds(items: readonly MerchantFeedItem[]): Map<string, string> {
  const keeper = new Map<string, string>();
  for (const item of items) {
    const held = keeper.get(item.sku);
    if (held === undefined || item.id < held) keeper.set(item.sku, item.id);
  }
  return new Map(items.map((item) => [item.id, item.sku && keeper.get(item.sku) === item.id ? item.sku : item.id]));
}

function itemXml(item: MerchantFeedItem, id: string, shop: FeedShop, brand: string | undefined): string {
  const title = clip(item.name.trim(), TITLE_MAX);
  // A description is required; a product without its own text is described by its name.
  const description = clip(plainText(item.descriptionHtml).join(" "), DESCRIPTION_MAX) || title;
  const gtin = gtinFromAttributes(item.attributes)?.value;
  const model = extractProductModel(item.attributes);
  const [image, ...more] = item.images;
  return [
    "<item>",
    tag("g:id", id),
    tag("title", title),
    tag("description", description),
    tag("link", `${shop.url}/product/${item.slug}`),
    tag("g:image_link", image),
    ...more.slice(0, EXTRA_IMAGES).map((url) => tag("g:additional_image_link", url)),
    tag("g:availability", item.inStock ? "in_stock" : "out_of_stock"),
    // With a discount the old price is the price and the current one the sale price.
    tag("g:price", amount(item.oldPrice ?? item.price)),
    item.oldPrice ? tag("g:sale_price", amount(item.price)) : "",
    tag("g:brand", brand),
    tag("g:gtin", gtin),
    tag("g:mpn", model),
    // "No identifiers" is a claim that the maker never assigned any: made only for goods with no brand at all.
    !brand && !gtin && !model ? tag("g:identifier_exists", "no") : "",
    tag("g:product_type", item.categoryPath.join(" > ")),
    tag("g:google_product_category", googleProductCategoryFromPath(item.categoryPath)),
    tag("g:condition", "new"),
    "</item>",
  ].filter(Boolean).join("\n");
}

/**
 * The product feed a shopping service fetches: RSS 2.0 with the `g:` namespace, one item per product.
 * An empty list is an error: served as a valid empty feed it would tell the service to drop every product.
 */
export function merchantFeedXml(items: readonly MerchantFeedItem[], shop: FeedShop): string {
  const eligible = items.filter(isMerchantFeedEligible);
  if (eligible.length === 0) throw new Error("Товарний фід порожній: порожній файл прибрав би всі товари з сервісу покупок");
  const ids = feedIds(eligible);
  const brands = resolveBrands(eligible);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    tag("title", shop.name),
    tag("link", shop.url),
    tag("description", shop.description),
    ...eligible.map((item) => itemXml(item, ids.get(item.id) ?? item.id, shop, brands.get(item.id))),
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}
