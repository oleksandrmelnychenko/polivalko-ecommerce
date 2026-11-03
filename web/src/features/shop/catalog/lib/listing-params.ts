import { first } from "@/shared/lib/format";
import type { ProductQuery } from "../api/server";

export type SearchParams = Record<string, string | string[] | undefined>;

export const SORTS = [
  { value: "name_asc", label: "За назвою" },
  { value: "price_asc", label: "Дешевші" },
  { value: "price_desc", label: "Дорожчі" },
];

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
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}
