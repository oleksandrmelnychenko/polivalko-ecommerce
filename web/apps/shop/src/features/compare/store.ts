"use client";

import { useSyncExternalStore } from "react";
import { browserApi } from "@polivalko/shared/api/browser";
import { comparisonGroup, fromDetails, type CompareProduct } from "./model";
import { notifyComparison } from "./notice";

const KEY = "polivalko.compare.v1";
const EVENT = "polivalko:compare";
const EMPTY: CompareProduct[] = [];
let previousRaw: string | null | undefined;
let snapshot = EMPTY;
let memoryOnly = false;

function read() {
  if (memoryOnly) return snapshot;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === previousRaw) return snapshot;
    previousRaw = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    snapshot = Array.isArray(parsed) ? parsed.filter((p): p is CompareProduct =>
      p && typeof p.id === "string" && typeof p.slug === "string" && /^[a-z0-9-]+$/i.test(p.slug) &&
      typeof p.name === "string" && typeof p.sku === "string" && typeof p.inStock === "boolean" &&
      typeof p.price?.value === "string" && Number.isFinite(Number(p.price.value)) && p.price?.currency === "UAH" &&
      (p.imageUrl == null || (typeof p.imageUrl === "string" && /^(https?:\/\/|\/[^/])/.test(p.imageUrl))) &&
      (p.brand == null || typeof p.brand === "string") &&
      (p.category == null || (typeof p.category.name === "string" && typeof p.category.slug === "string" && /^[a-z0-9-]+$/i.test(p.category.slug))) &&
      (p.attributes == null || (Array.isArray(p.attributes) && p.attributes.every((a: { name?: unknown; value?: unknown }) => a && typeof a.name === "string" && typeof a.value === "string")))
    ).filter((p, index, all) => all.findIndex(item => item.id === p.id) === index).slice(0, 20) : EMPTY;
  } catch { snapshot = EMPTY; }
  return snapshot;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}

function save(products: CompareProduct[]) {
  try { localStorage.setItem(KEY, JSON.stringify(products)); } catch { memoryOnly = true; }
  previousRaw = undefined;
  snapshot = products;
  window.dispatchEvent(new Event(EVENT));
}

export const useComparison = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export function removeComparison(id: string) {
  const current = read();
  const product = current.find(p => p.id === id);
  if (!product) return;
  save(current.filter(p => p.id !== id));
  notifyComparison({ kind: "removed", name: product.name });
}
export function clearComparisonGroup(key: string) { save(read().filter(p => comparisonGroup(p).key !== key)); }

export async function loadComparisonProduct(slug: string) {
  const { data } = await browserApi.GET("/api/v1/products/{slug}", { params: { path: { slug } } });
  if (!data) throw new Error("Не вдалося завантажити характеристики. Спробуйте ще раз.");
  return fromDetails(data);
}

export async function addComparison(product: CompareProduct) {
  const detail = await loadComparisonProduct(product.slug);
  // Re-read after the request: concurrent clicks must not drop another selection.
  const current = read();
  if (current.some(p => p.id === detail.id)) return;
  const key = comparisonGroup(detail).key;
  if (current.filter(p => comparisonGroup(p).key === key).length >= 4)
    throw new Error("У цій групі вже 4 товари. Приберіть один зі списку порівняння.");
  if (current.length >= 20) throw new Error("Список заповнений. Приберіть зайві товари з порівняння.");
  save([...current, detail]);
  notifyComparison({ kind: "added", name: detail.name, groupKey: key });
}

export function refreshComparison(details: CompareProduct[]) {
  const byId = new Map(details.map(p => [p.id, p]));
  // Preserve removals/additions made while refresh was pending.
  save(read().map(p => byId.get(p.id) ?? p));
}
