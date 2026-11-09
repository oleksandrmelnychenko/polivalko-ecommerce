import { refreshSession } from "@/features/customer";
import { MAX_QUANTITY } from "@/shared/lib/quantity";
import { openCart, saveCart, type ServerCart } from "../api/server-cart";

export type CartLine = {
  productId: string; quantity: number; name: string; slug: string; sku: string; price: string; imageUrl: string | null;
};
export type CartProduct = Omit<CartLine, "quantity">;
export const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), MAX_QUANTITY);
export const EMPTY: CartLine[] = [];
export const INITIAL = { lines: EMPTY, ready: false, saving: false, error: null as string | null, cart: null as ServerCart | null };
let snapshot = INITIAL;
let owner: string | null = null;
let generation = 0;
let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const SIGNAL = "pv-cart-sync-v2";
function publish(next: typeof INITIAL) { snapshot = next; listeners.forEach((l) => l()); }
function accept(cart: ServerCart) {
  publish({ ready: true, saving: false, error: null, cart, lines: cart.items.map((i) => ({
    productId: i.productId, quantity: i.quantity, name: i.name, slug: i.slug, sku: i.sku,
    price: i.unitPrice.value, imageUrl: i.imageUrl ?? null,
  })) });
}
export const getSnapshot = () => snapshot;
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function signal() { try { localStorage.setItem(SIGNAL, crypto.randomUUID()); } catch {} }
export function connect(nextOwner: string) {
  if (owner === nextOwner) return;
  owner = nextOwner;
  const current = ++generation;
  publish(INITIAL);
  queue = openCart().then((cart) => {
    if (current === generation) accept(cart);
  }).catch(() => {
    if (current === generation) publish({ ...snapshot, error: "Не вдалося завантажити кошик. Спробуйте ще раз." });
  });
}
export function refreshCart() {
  const current = generation;
  queue = queue.then(async () => {
    if (current !== generation) return;
    try { const cart = await openCart(); if (current === generation) accept(cart); }
    catch { if (current === generation) publish({ ...snapshot, error: "Не вдалося оновити кошик. Перевірте з’єднання." }); }
  });
  return queue;
}
export async function settledCart() {
  await queue;
  if (!snapshot.ready || snapshot.error || !snapshot.cart) throw new Error("Кошик ще не збережено на сервері.");
  return snapshot.cart;
}
export function watchCart() {
  const focus = async () => {
    const session = await refreshSession();
    connect(session.me?.id ?? "guest");
    await refreshCart();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === SIGNAL) void refreshCart();
    if (event.key === "pv-customer") void focus();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("focus", focus);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener("focus", focus); };
}
export function update(change: (lines: CartLine[]) => CartLine[]) {
  const current = generation;
  queue = queue.then(async () => {
    if (current !== generation) return;
    if (!snapshot.cart) throw new Error("Кошик недоступний.");
    const cart = snapshot.cart;
    const items = change(snapshot.lines).map(({ productId, quantity }) => ({ productId, quantity }));
    publish({ ...snapshot, saving: true, error: null });
    const saved = await saveCart(cart, items);
    if (current === generation) { accept(saved); signal(); }
  }).catch(async (error: unknown) => {
    if (current !== generation) return;
    // Never overwrite another tab's newer cart with stale quantities.
    try { const fresh = await openCart(); if (current === generation) accept(fresh); } catch {}
    if (current === generation) publish({ ...snapshot, saving: false, error: error instanceof Error ? error.message : "Не вдалося зберегти кошик." });
  });
}
