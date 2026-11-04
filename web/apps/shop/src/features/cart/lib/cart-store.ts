import { MAX_QUANTITY } from "@/shared/lib/quantity";

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
export const EMPTY: CartLine[] = [];

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

export function getSnapshot(): CartLine[] {
  snapshot ??= read();
  return snapshot;
}

export function subscribe(listener: () => void) {
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

export function update(change: (lines: CartLine[]) => CartLine[]) {
  snapshot = change(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
  listeners.forEach((l) => l());
}

export const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), MAX_QUANTITY);
