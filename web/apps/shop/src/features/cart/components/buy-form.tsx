"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { InCartButton } from "./in-cart-button";
import { recheckStock, useLiveStock } from "@/shared/lib/live-stock";
import { PurchaseIcon } from "./purchase-icon";
import { QuantityStepper } from "@/shared/ui/quantity-stepper";
import type { CartProduct } from "../lib/cart-store";
import { useCart } from "./cart-provider";

export function BuyForm({
  product,
  inStock,
  className,
  actionsClassName,
  children,
  aside,
}: {
  product: CartProduct;
  inStock: boolean;
  className?: string;
  actionsClassName?: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  const { add, lines } = useCart();
  const line = lines.find(item => item.productId === product.productId);
  // The page may be minutes old: the live answer decides, the page's own value holds until it arrives.
  const live = useLiveStock(product.productId);
  const inStockNow = live ? live.inStock : inStock;
  const available = live === undefined ? undefined : live === null ? null : live.available;
  const [quantity, setQuantity] = useState(1);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!line && inStockNow && available !== 0) {
      add(product, typeof available === "number" ? Math.min(quantity, available) : quantity);
    }
  }

  return (
    <form className={className} onSubmit={onSubmit} aria-label={`До кошика: ${product.name}`}>
      {children}
      <div className={actionsClassName}>
        {line ? (
          <InCartButton name={product.name} quantity={line.quantity} className="btn btn--graphite" />
        ) : available === null ? (
          <button type="button" className="btn btn--quiet" onClick={() => recheckStock(product.productId)}>Повторити перевірку наявності</button>
        ) : inStockNow && available !== 0 ? (
          <>
            <QuantityStepper max={available} value={Math.min(quantity, available ?? quantity)} onChange={setQuantity} label={`Кількість: ${product.name}`} />
            <button type="submit" className="btn btn--graphite cart-purchase">
              <PurchaseIcon />
              До кошика
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--quiet" disabled>
            Немає в наявності
          </button>
        )}
        {aside}
      </div>
    </form>
  );
}
