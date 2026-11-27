"use client";

import { InCartButton } from "./in-cart-button";
import { PurchaseIcon } from "./purchase-icon";
import type { CartProduct } from "../lib/cart-store";
import { useCart } from "./cart-provider";

export function AddToCart({ product, inStock }: { product: CartProduct; inStock: boolean }) {
  const { add, lines, ready } = useCart();
  const line = lines.find(item => item.productId === product.productId);
  if (line) return <InCartButton name={product.name} quantity={line.quantity} className="tile__buy" />;
  if (!inStock) return null;
  return (
    <button type="button" className="tile__buy cart-purchase" disabled={!ready} onClick={() => add(product, 1)} aria-label={`До кошика: ${product.name}`}>
      <PurchaseIcon />
      <span aria-hidden="true">До кошика</span>
    </button>
  );
}
