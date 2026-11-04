import { browserApi } from "@polivalko/shared/api/browser";

export function quoteCart(items: { productId: string; quantity: number }[]) {
  return browserApi.POST("/api/v1/checkout/quote", { body: { items } });
}
