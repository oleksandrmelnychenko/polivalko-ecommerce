"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useCart, type CartProduct } from "@/lib/cart";
import { CartIcon, CartPlusIcon } from "./icons";
import { QuantityStepper } from "./quantity-stepper";

/**
 * Блок покупки як форма: кількість і «Купити»; Enter у полі кількості теж додає в кошик.
 * `children` — опис товару, що входить у блок (назва, ціна, наявність).
 */
export function BuyForm({
  product,
  inStock,
  className,
  actionsClassName,
  children,
}: {
  product: CartProduct;
  inStock: boolean;
  className?: string;
  actionsClassName?: string;
  children?: ReactNode;
}) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inStock) add(product, quantity);
  }

  return (
    <form className={className} onSubmit={onSubmit} aria-label={`Купити: ${product.name}`}>
      {children}
      <div className={actionsClassName}>
        {inStock ? (
          <>
            <QuantityStepper value={quantity} onChange={setQuantity} label={`Кількість: ${product.name}`} />
            <button type="submit" className="btn">
              <CartIcon />
              Купити
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--quiet" disabled>
            Немає в наявності
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Кнопка «У кошик» у плитці: одна штука в кошик. Звичайна — смуга знизу фото; `round` — кругла кнопка
 * лукбук-плитки, як у референсі. Товару без залишку кнопка не потрібна.
 */
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
