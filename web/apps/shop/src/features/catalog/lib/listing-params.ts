import { first } from "@polivalko/shared/lib/format";
import type { ProductQuery } from "../api/server";

export type SearchParams = Record<string, string | string[] | undefined>;

export const SORTS = [
  { value: "name_asc", label: "За назвою, А–Я" },
  { value: "name_desc", label: "За назвою, Я–А" },
  { value: "price_asc", label: "Спочатку дешевші" },
  { value: "price_desc", label: "Спочатку дорожчі" },
];

export const PAGE_SIZES = [24, 48, 96];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

const PRICE_STEPS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

export type PriceRange = { min?: number; max?: number; label: string };

export function priceRanges(low: number, high: number): PriceRange[] {
  const inside = PRICE_STEPS.filter((step) => step > low && step < high);
  if (inside.length === 0) return [];
  const picks = inside.length <= 3 ? inside : [1, 2, 3].map((k) => inside[Math.round((k * (inside.length + 1)) / 4) - 1]);
  const bounds = Array.from(new Set(picks)).sort((a, b) => a - b);
  const money = (n: number) => n.toLocaleString("uk-UA");
  return [
    { max: bounds[0], label: `до ${money(bounds[0])} ₴` },
    ...bounds.slice(1).map((b, i) => ({ min: bounds[i], max: b, label: `${money(bounds[i])} – ${money(b)} ₴` })),
    { min: bounds[bounds.length - 1], label: `від ${money(bounds[bounds.length - 1])} ₴` },
  ];
}

export function parseListingParams(sp: SearchParams) {
  const all = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).filter(Boolean);
  };
  const num = (key: string) => {
    const n = Number(first(sp[key]));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const attrs = (Array.isArray(sp.f) ? sp.f : sp.f ? [sp.f] : []).filter((x) => x.includes(":"));
  return {
    brands: all("brand"),
    attrs,
    inStock: first(sp.inStock) === "true",
    onSale: first(sp.onSale) === "true",
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    sort: SORTS.some((s) => s.value === first(sp.sort)) ? first(sp.sort)! : "name_asc",
    page: Math.max(Number(first(sp.page)) || 1, 1),
    pageSize: PAGE_SIZES.includes(Number(first(sp.pageSize))) ? Number(first(sp.pageSize)) : DEFAULT_PAGE_SIZE,
  };
}

export type Parsed = ReturnType<typeof parseListingParams>;

export function toQuery(base: ProductQuery, p: Parsed): ProductQuery {
  return {
    ...base,
    brand: p.brands.length ? p.brands.join(",") : undefined,
    f: p.attrs.length ? p.attrs : undefined,
    inStock: p.inStock || undefined,
    onSale: p.onSale || undefined,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    sort: p.sort,
    page: p.page,
    pageSize: p.pageSize,
  };
}

export function hrefFor(basePath: string, fixed: Record<string, string>, p: Parsed, patch: Partial<Parsed>) {
  const next = { ...p, ...patch };
  const qs = new URLSearchParams(fixed);
  next.brands.forEach((b) => qs.append("brand", b));
  next.attrs.forEach((a) => qs.append("f", a));
  if (next.inStock) qs.set("inStock", "true");
  if (next.onSale) qs.set("onSale", "true");
  if (next.priceMin) qs.set("priceMin", String(next.priceMin));
  if (next.priceMax) qs.set("priceMax", String(next.priceMax));
  if (next.sort !== "name_asc") qs.set("sort", next.sort);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) qs.set("pageSize", String(next.pageSize));
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}
