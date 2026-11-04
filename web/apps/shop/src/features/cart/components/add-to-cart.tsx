"use client";

import { CartIcon, CartPlusIcon } from "@polivalko/shared/ui/icons";
import type { CartProduct } from "../lib/cart-store";
import { useCart } from "./cart-provider";

export function AddToCart({ product, inStock, round }: { product: CartProduct; inStock: boolean; round?: boolean }) {
  const { add } = useCart();
  if (!inStock) return null;
  if (round) {
    return (
      <button type="button" className="round-btn" onClick={() => add(product, 1)} aria-label={`У кошик: ${product.name}`}>
        <CartPlusIcon />
      </button>
    );
  }
  return (
    <button type="button" className="tile__cart" onClick={() => add(product, 1)} aria-label={`У кошик: ${product.name}`}>
      <CartIcon />
      <span aria-hidden="true">У кошик</span>
    </button>
  );
}
