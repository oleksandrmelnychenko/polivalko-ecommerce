import { withAccountCsrf } from "@/features/customer";
import { browserApi } from "@polivalko/shared/api/browser";
import type { components } from "@polivalko/shared/api/schema";
import type { CreateOrderRequest } from "@polivalko/shared/api/types";

export type ServerCart = components["schemas"]["ServerCartDto"];

export async function openCart(owner: string | null): Promise<ServerCart> {
  const result = await withAccountCsrf((headers) => browserApi.POST("/api/v1/cart/open", { headers, cache: "no-store" }), owner);
  if (!result.data) throw new Error("Не вдалося завантажити кошик.");
  return result.data;
}

export async function saveCart(cart: ServerCart, items: { productId: string; quantity: number }[], owner: string | null): Promise<ServerCart> {
  const result = await withAccountCsrf((headers) => browserApi.PUT("/api/v1/cart", {
    headers,
    cache: "no-store",
    body: { cartId: cart.id, revision: cart.revision, items },
  }).catch(() => {
    throw new Error("Не вдалося зв’язатися із сервером. Спробуйте ще раз.");
  }), owner);
  if (!result.data) throw new Error(result.error?.detail ?? "Не вдалося зберегти кошик.");
  return result.data;
}

export function checkoutCart(cart: ServerCart, order: CreateOrderRequest) {
  return withAccountCsrf((headers) => browserApi.POST("/api/v1/cart/checkout", {
    headers,
    cache: "no-store",
    body: { cartId: cart.id, revision: cart.revision, order },
  }));
}
