import { withCsrf, type CsrfHeaders } from "@/features/customer";
import type { CreateOrderRequest, Quote } from "@polivalko/shared/api/types";
import type { Problem } from "@polivalko/shared/api/problem";

import type { components } from "@polivalko/shared/api/schema";
type OrderCreated = components["schemas"]["OrderCreatedDto"];

export type ServerCart = { id: string; revision: number; items: Quote["items"]; lastOrder: OrderCreated | null };
async function request<T>(path: string, method: string, headers: CsrfHeaders, body?: unknown) {
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", headers: { ...headers, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json();
  return { response, data: response.ok ? value as T : undefined, error: response.ok ? undefined : value as Problem };
}
export async function openCart(): Promise<ServerCart> {
  const result = await withCsrf((headers) => request<ServerCart>("/api/v1/cart/open", "POST", headers));
  if (!result.data) throw new Error(result.error?.detail ?? "Не вдалося завантажити кошик.");
  return result.data;
}
export async function saveCart(cart: ServerCart, items: { productId: string; quantity: number }[]): Promise<ServerCart> {
  const result = await withCsrf((headers) => request<ServerCart>("/api/v1/cart/", "PUT", headers, { cartId: cart.id, revision: cart.revision, items }));
  if (!result.data) throw new Error(result.error?.detail ?? "Не вдалося зберегти кошик.");
  return result.data;
}
export function checkoutCart(cart: ServerCart, order: CreateOrderRequest) {
  return withCsrf((headers) => request<OrderCreated>("/api/v1/cart/checkout", "POST", headers, { cartId: cart.id, revision: cart.revision, order }));
}
