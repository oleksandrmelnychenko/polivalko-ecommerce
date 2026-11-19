"use client";

import { CartIcon } from "@polivalko/shared/ui/icons";
import type { CartProduct } from "../lib/cart-store";
import { useCart } from "./cart-provider";

export function AddToCart({ product, inStock }: { product: CartProduct; inStock: boolean }) {
  const { add } = useCart();
  if (!inStock) return null;
  return (
    <button type="button" className="tile__buy" onClick={() => add(product, 1)} aria-label={`У кошик: ${product.name}`}>
      <CartIcon />
      <span aria-hidden="true">Купити</span>
    </button>
  );
}
