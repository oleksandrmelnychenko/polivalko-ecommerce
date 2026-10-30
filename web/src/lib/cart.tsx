"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { track } from "./analytics";

/**
 * Кошик гостя. У браузері зберігаються лише позиції й кількості (це не секрет, розділ 2 ТЗ);
 * ціну й наявність перед оформленням перераховує сервер (POST /api/v1/checkout/quote).
 * Знімок назви й ціни потрібен лише для миттєвого показу шухляди.
 */
export type CartLine = {
  productId: string;
  quantity: number;
  name: string;
  slug: string;
  sku: string;
  price: string;
  imageUrl: string | null;
};

export type CartProduct = Omit<CartLine, "quantity">;

const STORAGE_KEY = "pv-cart-v1";
export const MAX_QUANTITY = 999;
const EMPTY: CartLine[] = [];

// Зовнішнє сховище поверх localStorage: синхронізується між вкладками через подію storage.
let snapshot: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((l): l is CartLine => typeof l?.productId === "string" && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

function getSnapshot(): CartLine[] {
  snapshot ??= read();
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    snapshot = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(change: (lines: CartLine[]) => CartLine[]) {
  snapshot = change(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Приватний режим або заблоковане сховище: кошик живе до перезавантаження сторінки.
  }
  listeners.forEach((l) => l());
}

const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), MAX_QUANTITY);

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
