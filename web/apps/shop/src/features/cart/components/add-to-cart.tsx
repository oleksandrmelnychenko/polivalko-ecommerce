"use client";

import { CartPlusIcon } from "@polivalko/shared/ui/icons";
import type { CartProduct } from "../lib/cart-store";
import { useCart } from "./cart-provider";

export function AddToCart({ product, inStock }: { product: CartProduct; inStock: boolean }) {
  const { add } = useCart();
  if (!inStock) return null;
  return (
    <button type="button" className="tile__buy" onClick={() => add(product, 1)} aria-label={`У кошик: ${product.name}`}>
      <CartPlusIcon />
      <span aria-hidden="true">У кошик</span>
    </button>
  );
}
