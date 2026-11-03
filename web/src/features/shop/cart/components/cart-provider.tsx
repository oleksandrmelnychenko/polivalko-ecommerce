"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { track } from "@/features/shop/analytics";
import { clamp, EMPTY, getSnapshot, subscribe, update, type CartLine, type CartProduct } from "../lib/cart-store";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  add: (product: CartProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const [isOpen, setOpen] = useState(false);

  const add = useCallback((product: CartProduct, quantity = 1) => {
    update((current) => {
      const existing = current.find((l) => l.productId === product.productId);
      return existing
        ? current.map((l) => (l === existing ? { ...l, ...product, quantity: clamp(l.quantity + quantity) } : l))
        : [...current, { ...product, quantity: clamp(quantity) }];
    });
    const price = Number(product.price);
    track("add_to_cart", {
      currency: "UAH",
      value: price * quantity,
      items: [{ item_id: product.sku, item_name: product.name, price, quantity }],
    });
    setOpen(true);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0),
      isOpen,
      add,
      setQuantity: (productId, quantity) =>
        update((current) => current.map((l) => (l.productId === productId ? { ...l, quantity: clamp(quantity) } : l))),
      remove: (productId) => update((current) => current.filter((l) => l.productId !== productId)),
      clear: () => update(() => []),
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [lines, isOpen, add],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart: немає CartProvider");
  return context;
}
