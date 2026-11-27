"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { InCartButton } from "./in-cart-button";
import { quoteCart } from "@/shared/api/quote-cart";
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
  const [stock, setStock] = useState<{ id: string; available: number | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inCart = Boolean(line);
  useEffect(() => {
    if (!inStock || inCart) return;
    const controller = new AbortController();
    quoteCart([{ productId: product.productId, quantity: 1 }], controller.signal)
      .then(({ data }) => data?.items.find(item => item.productId === product.productId)?.availableQuantity ?? null)
      .catch(() => null)
      .then(available => { if (!controller.signal.aborted) setStock({ id: product.productId, available }); });
    return () => controller.abort();
  }, [product.productId, inStock, inCart, attempt]);
  const available = stock?.id === product.productId ? stock.available : undefined;
  const [quantity, setQuantity] = useState(1);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!line && inStock && available !== 0) {
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
          <button type="button" className="btn btn--quiet" onClick={() => setAttempt(n => n + 1)}>Повторити перевірку наявності</button>
        ) : inStock && available !== 0 ? (
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
