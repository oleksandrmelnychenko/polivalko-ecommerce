import type { Money } from "@polivalko/shared/api/types";

/** Показуємо замість «0 ₴»: товар без роздрібної ціни замовити не можна. */
export const PRICE_ON_REQUEST = "Ціну уточнюйте";

export function hasPrice(price: Pick<Money, "value">): boolean {
  return Number(price.value) > 0;
}

/** Купити можна товар, що є в наявності й має ціну; так само його перевіряє оформлення замовлення. */
export function canBuy(product: { inStock: boolean; price: Pick<Money, "value"> }): boolean {
  return product.inStock && hasPrice(product.price);
}
