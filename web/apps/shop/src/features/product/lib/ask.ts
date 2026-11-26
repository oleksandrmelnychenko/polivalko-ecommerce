import type { ProductDetails } from "@polivalko/shared/api/types";
import { canBuy, hasPrice } from "@/shared/lib/price";

/** What a visitor can ask the shop about a product that cannot be bought on the site right now; null when it can. */
export function askLine(product: Pick<ProductDetails, "inStock" | "price">): string | null {
  if (canBuy(product)) return null;
  return hasPrice(product.price) ? "Наявність і строк поставки уточніть телефоном" : "Ціну й наявність уточніть телефоном";
}

/** A dialable link from the phone number as the shop writes it. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
