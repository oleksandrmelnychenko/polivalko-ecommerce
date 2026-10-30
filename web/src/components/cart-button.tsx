"use client";

import { useCart } from "@/lib/cart";
import { BagIcon } from "./icons";

/** Кошик у шапці, як у референсі: сумка з жовтим лічильником. */
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
