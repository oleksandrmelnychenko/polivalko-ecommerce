import type { MerchantFeedItem } from "@polivalko/shared/api/types";
import { plainText } from "@polivalko/shared/lib/format";
import { gtinFromAttributes } from "@polivalko/shared/lib/gtin";
import { clip } from "@/shared/lib/clip";
import { googleProductCategoryFromPath } from "@/shared/lib/google-product-taxonomy";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const EXTRA_IMAGES = 10;
const MODEL_ATTRIBUTE = "модель виробника";

// Google Merchant Center prohibits tobacco and smoking items (e.g. smoking tobacco seeds),
// while garden pest-control "тютюновий пил" remains allowed.
const PROHIBITED_TOBACCO_PATTERN =
  /(?:^|[^\p{L}])(?:тютюн\s+курильн\p{L}*|курильн\p{L}*\s+тютюн\p{L}*|табак\s+курительн\p{L}*|махорк\p{L}*|сигарет\p{L}*|сигар\p{L}*|кальян\p{L}*|вейп\p{L}*|smoking\s+tobacco)(?=$|[^\p{L}])/iu;

export function isMerchantFeedEligible(item: Pick<MerchantFeedItem, "name" | "slug">): boolean {
  const text = `${item.name} ${item.slug.replace(/-/g, " ")}`;
  return !PROHIBITED_TOBACCO_PATTERN.test(text);
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

function itemXml(item: MerchantFeedItem, id: string, shop: FeedShop): string {
  const title = clip(item.name.trim(), TITLE_MAX);
  // A description is required; a product without its own text is described by its name.
  const description = clip(plainText(item.descriptionHtml).join(" "), DESCRIPTION_MAX) || title;
  const brand = item.brand?.trim();
  const gtin = gtinFromAttributes(item.attributes)?.value;
  const model = item.attributes.find((attribute) => attribute.name.trim().toLowerCase() === MODEL_ATTRIBUTE)?.value.trim();
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
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    tag("title", shop.name),
    tag("link", shop.url),
    tag("description", shop.description),
    ...eligible.map((item) => itemXml(item, ids.get(item.id) ?? item.id, shop)),
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}
