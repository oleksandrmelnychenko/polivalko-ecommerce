"use client";

import type { ReactNode } from "react";
import { useLiveStock } from "@/shared/lib/live-stock";
import { InCartButton } from "./in-cart-button";
import { PurchaseIcon } from "./purchase-icon";
import type { CartProduct } from "../lib/cart-store";
import { useCart } from "./cart-provider";

/**
 * The card's buy button. The page may be minutes old, so the live stock decides: a product sold out since shows
 * `fallback` instead, one back in stock gets the button again.
 */
export function AddToCart({ product, inStock, fallback = null }: { product: CartProduct; inStock: boolean; fallback?: ReactNode }) {
  const { add, lines } = useCart();
  const live = useLiveStock(product.productId);
  const line = lines.find(item => item.productId === product.productId);
  if (line) return <InCartButton name={product.name} quantity={line.quantity} className="tile__buy" />;
  if (!(live ? live.inStock : inStock)) return fallback;
  return (
    <button type="button" className="tile__buy cart-purchase" onClick={() => add(product, 1)} aria-label={`До кошика: ${product.name}`}>
      <PurchaseIcon />
      <span aria-hidden="true">До кошика</span>
    </button>
  );
}
