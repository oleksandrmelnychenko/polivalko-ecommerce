"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CartIcon } from "@polivalko/shared/ui/icons";
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
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inStock) add(product, quantity);
  }

  return (
    <form className={className} onSubmit={onSubmit} aria-label={`У кошик: ${product.name}`}>
      {children}
      <div className={actionsClassName}>
        {inStock ? (
          <>
            <QuantityStepper value={quantity} onChange={setQuantity} label={`Кількість: ${product.name}`} />
            <button type="submit" className="btn">
              <CartIcon />
              У кошик
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
