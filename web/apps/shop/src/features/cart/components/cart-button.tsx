"use client";

import { BagIcon } from "@polivalko/shared/ui/icons";
import { useCart } from "./cart-provider";

export function CartButton() {
  const { count, open, isOpen } = useCart();
  return (
    <button type="button" id="header-cart-button" className="icon-btn icon-btn--chrome cart-button" onClick={open} aria-haspopup="dialog" aria-expanded={isOpen} aria-controls="mini-cart" aria-label={count > 0 ? `Кошик, позицій: ${count}` : "Кошик"}>
      <BagIcon />
      {count > 0 && <span key={count} className="cart-button__count" aria-hidden="true">
        {count}
      </span>}
    </button>
  );
}
