"use client";

import { ShoppingBagIcon } from "@polivalko/shared/ui/icons";
import { useCart } from "./cart-provider";

export function CartButton() {
  const { count, open, close, isOpen } = useCart();
  return (
    <button type="button" id="header-cart-button" className="icon-btn icon-btn--chrome cart-button" onClick={isOpen ? close : open} aria-expanded={isOpen} aria-controls="mini-cart" aria-label={count > 0 ? `Кошик, позицій: ${count}` : "Кошик"}>
      <ShoppingBagIcon />
      {count > 0 && <span key={count} className="cart-button__count" aria-hidden="true">
        {count}
      </span>}
    </button>
  );
}
