"use client";

import { useEffect, useSyncExternalStore } from "react";
import { browserApi } from "@polivalko/shared/api/browser";

/**
 * Live availability of the products a page shows. The page itself may be minutes old (the CDN keeps a copy), so after
 * loading the browser asks `/api/v1/catalog/availability` for every product on the page in one request, and again
 * when the shopper comes back to the tab. A product sold out a moment ago stops offering «До кошика»; one back in
 * stock offers it again. Checkout checks the stock once more, so this only keeps the page honest.
 */
export type LiveStock = { inStock: boolean; available: number } | null;

const MAX_PER_REQUEST = 100;
const REFRESH_AFTER_MS = 15_000;

const known = new Map<string, LiveStock>();
const watched = new Map<string, number>();
const listeners = new Set<() => void>();
let queued = new Set<string>();
let scheduled = false;
let lastFetch = 0;

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(ids: string[]) {
  lastFetch = Date.now();
  for (let start = 0; start < ids.length; start += MAX_PER_REQUEST) {
    const chunk = ids.slice(start, start + MAX_PER_REQUEST);
    try {
      const { data } = await browserApi.GET("/api/v1/catalog/availability", { params: { query: { ids: chunk.join(",") } }, cache: "no-store" });
      if (!data) throw new Error("no answer");
      const answered = new Map(data.map((row) => [row.productId, row]));
      // A product the answer leaves out is hidden or gone: it cannot be bought.
      for (const id of chunk) known.set(id, answered.has(id) ? { inStock: answered.get(id)!.inStock, available: answered.get(id)!.available } : { inStock: false, available: 0 });
    } catch {
      for (const id of chunk) known.set(id, null);
    }
  }
  notify();
}

function request(ids: Iterable<string>) {
  for (const id of ids) queued.add(id);
  if (scheduled) return;
  scheduled = true;
  // Every component of the page registers in the same render: one request covers them all.
  setTimeout(() => {
    scheduled = false;
    const ids = [...queued];
    queued = new Set();
    if (ids.length) void load(ids);
  }, 0);
}

/** Asks again for one product, after a failed check. */
export function recheckStock(productId: string) {
  known.delete(productId);
  notify();
  request([productId]);
}

if (typeof window !== "undefined") {
  const refresh = () => {
    if (document.visibilityState !== "visible" || Date.now() - lastFetch < REFRESH_AFTER_MS) return;
    request(watched.keys());
  };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", (event) => { if (event.persisted) request(watched.keys()); });
}

/**
 * The live stock of a product: undefined until the first answer, null when the check failed, otherwise the answer.
 * The page's own value is what the HTML said; components show it until the live one arrives.
 */
export function useLiveStock(productId: string): LiveStock | undefined {
  useEffect(() => {
    watched.set(productId, (watched.get(productId) ?? 0) + 1);
    // A page reached by client navigation may show products already asked about: ask again once the answer is old.
    if (!known.has(productId) || Date.now() - lastFetch >= REFRESH_AFTER_MS) request([productId]);
    return () => {
      const left = (watched.get(productId) ?? 1) - 1;
      if (left > 0) watched.set(productId, left);
      else watched.delete(productId);
    };
  }, [productId]);
  return useSyncExternalStore(subscribe, () => known.get(productId), () => undefined);
}
