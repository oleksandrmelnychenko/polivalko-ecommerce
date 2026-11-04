"use client";

import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useCartQuote } from "../hooks/use-cart-quote";
import { cartRows } from "../lib/cart-rows";
import { CartEmpty } from "./cart-empty";
import { CartLines } from "./cart-lines";
import { useCart } from "./cart-provider";
import { CartSummary } from "./cart-summary";

export function CartView() {
  const { lines, count, setQuantity, remove, clear } = useCart();
  const { quote, failed } = useCartQuote();
  const hydrated = useHydrated();

  if (!hydrated) return <div className="skeleton" style={{ height: "var(--space-4xl)" }} aria-busy="true" />;

  if (lines.length === 0) return <CartEmpty />;

  const blocking = quote?.items.some((i) => i.issue) ?? false;
  const rows = cartRows(quote, lines);

  return (
    <div className="cart">
      <CartLines rows={rows} quote={quote} failed={failed} setQuantity={setQuantity} remove={remove} clear={clear} />
      <CartSummary quote={quote} count={count} blocking={blocking} />
    </div>
  );
}
