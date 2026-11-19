import { refreshChangedSession, refreshSession, SESSION_SIGNAL } from "@/features/customer";
import { MAX_QUANTITY } from "@/shared/lib/quantity";
import { openCart, saveCart, type ServerCart } from "../api/server-cart";

export type CartLine = {
  productId: string; quantity: number; name: string; slug: string; sku: string; price: string; imageUrl: string | null;
};
export type CartProduct = Omit<CartLine, "quantity">;
type Change = (lines: CartLine[]) => CartLine[];
export const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), MAX_QUANTITY);
export const EMPTY: CartLine[] = [];
export const INITIAL = { lines: EMPTY, ready: false, saving: false, error: null as string | null, cart: null as ServerCart | null, owner: null as string | null };
let snapshot = INITIAL;
let generation = 0;
let queue: Promise<void> = Promise.resolve();
let early: Change[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const desired = new Map<string, number>();
const listeners = new Set<() => void>();
const SIGNAL = "pv-cart-sync-v2";
const QUANTITY_DELAY = 400;
function publish(next: typeof INITIAL) { snapshot = next; listeners.forEach((l) => l()); }
function withDesired(lines: CartLine[]) {
  return desired.size === 0 ? lines : lines.map((l) => ({ ...l, quantity: desired.get(l.productId) ?? l.quantity }));
}
function dropPending() { if (timer) clearTimeout(timer); timer = null; desired.clear(); }
function accept(cart: ServerCart) {
  for (const id of [...desired.keys()]) if (!cart.items.some((i) => i.productId === id)) desired.delete(id);
  publish({ ...snapshot, ready: true, saving: desired.size > 0, error: null, cart, lines: withDesired(cart.items.map((i) => ({
    productId: i.productId, quantity: i.quantity, name: i.name, slug: i.slug, sku: i.sku,
    price: i.unitPrice.value, imageUrl: i.imageUrl ?? null,
  }))) });
}
export const getSnapshot = () => snapshot;
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function signal() { try { localStorage.setItem(SIGNAL, crypto.randomUUID()); } catch {} }
export function connect(nextOwner: string) {
  if (snapshot.owner === nextOwner) return;
  const current = ++generation;
  dropPending();
  publish({ ...INITIAL, owner: nextOwner });
  queue = openCart().then((cart) => {
    if (current === generation) accept(cart);
  }).catch(() => {
    if (current === generation) publish({ ...snapshot, error: "Не вдалося завантажити кошик. Спробуйте ще раз." });
  });
  const changes = early;
  early = [];
  changes.forEach(update);
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
  do { flushQuantities(); await queue; } while (desired.size > 0);
  if (!snapshot.ready || snapshot.error || !snapshot.cart) throw new Error("Кошик ще не збережено на сервері.");
  return snapshot.cart;
}
export function watchCart() {
  const syncSession = async (load: typeof refreshSession) => {
    const session = await load();
    if (session.status === "unknown") return;
    connect(session.me?.id ?? "guest");
    await refreshCart();
  };
  const focus = () => void syncSession(refreshSession);
  const storage = (event: StorageEvent) => {
    if (event.key === SIGNAL) void refreshCart();
    if (event.key === SESSION_SIGNAL) void syncSession(refreshChangedSession);
  };
  window.addEventListener("storage", storage);
  window.addEventListener("focus", focus);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener("focus", focus); };
}
function run(change: Change | null) {
  const current = generation;
  queue = queue.then(async () => {
    if (current !== generation) return;
    if (!change && desired.size === 0) return;
    if (!snapshot.cart) {
      const opened = await openCart();
      if (current !== generation) return;
      accept(opened);
    }
    const cart = snapshot.cart;
    if (!cart) throw new Error("Кошик недоступний.");
    const sent = new Map(desired);
    const items = (change ? change(snapshot.lines) : snapshot.lines).map(({ productId, quantity }) => ({ productId, quantity }));
    publish({ ...snapshot, saving: true, error: null });
    const saved = await saveCart(cart, items);
    if (current !== generation) return;
    sent.forEach((quantity, id) => { if (desired.get(id) === quantity) desired.delete(id); });
    accept(saved);
    signal();
    if (desired.size > 0 && !timer) timer = setTimeout(flushQuantities, QUANTITY_DELAY);
  }).catch(async (error: unknown) => {
    if (current !== generation) return;
    dropPending();
    try { const fresh = await openCart(); if (current === generation) accept(fresh); } catch {}
    if (current === generation) publish({ ...snapshot, saving: false, error: error instanceof Error ? error.message : "Не вдалося зберегти кошик." });
  });
}
export function update(change: Change) {
  if (!snapshot.owner) { early.push(change); return; }
  run(change);
}
export function setQuantity(productId: string, quantity: number) {
  if (!snapshot.lines.some((l) => l.productId === productId)) return;
  desired.set(productId, clamp(quantity));
  publish({ ...snapshot, saving: true, error: null, lines: withDesired(snapshot.lines) });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushQuantities, QUANTITY_DELAY);
}
export function flushQuantities() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (desired.size > 0) run(null);
}
