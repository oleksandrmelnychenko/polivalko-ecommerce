"use client";

import { BagIcon } from "@polivalko/shared/ui/icons";
import { useCart } from "./cart-provider";

export function CartButton() {
  const { count, open } = useCart();
  return (
    <button type="button" className="icon-btn icon-btn--chrome cart-button" onClick={open} aria-haspopup="dialog" aria-label={count > 0 ? `Кошик, позицій: ${count}` : "Кошик"}>
      <BagIcon />
      <span className="cart-button__count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
