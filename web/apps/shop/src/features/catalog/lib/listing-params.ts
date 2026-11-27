import { first } from "@polivalko/shared/lib/format";
import type { ProductQuery } from "../api/server";

export type SearchParams = Record<string, string | string[] | undefined>;

export const SORTS = [
  { value: "recommended", label: "Рекомендований порядок" },
  { value: "seasonal", label: "Спочатку сезонні" },
  { value: "name_asc", label: "За назвою, від А до Я" },
  { value: "name_desc", label: "За назвою, від Я до А" },
  { value: "price_asc", label: "Спочатку дешевші" },
  { value: "price_desc", label: "Спочатку дорожчі" },
];

export const PAGE_SIZES = [24, 48, 96];
export function listingPageSizes(path: string) {
  return path === "/sale" ? [20, ...PAGE_SIZES] : PAGE_SIZES;
}

const MAX_PAGE = 100_000;

export function parsePage(value: string | string[] | undefined): number {
  const page = Number(first(value));
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

export function priceOrder(min: number | undefined, max: number | undefined): [number | undefined, number | undefined] {
  return min !== undefined && max !== undefined && min > max ? [max, min] : [min, max];
}

export function parseListingParams(sp: SearchParams, path = "") {
  const sizes = listingPageSizes(path);
  const all = (key: string) => {
    const v = sp[key];
    return [...new Set((Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).filter(Boolean))];
  };
  const num = (key: string) => {
    const n = Number(first(sp[key]));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const attrs = [...new Set((Array.isArray(sp.f) ? sp.f : sp.f ? [sp.f] : []).filter((x) => x.includes(":")))];
  const [priceMin, priceMax] = priceOrder(num("priceMin"), num("priceMax"));
  return {
    brands: all("brand"),
    attrs,
    inStock: first(sp.inStock) === "true",
    onSale: first(sp.onSale) === "true",
    priceMin,
    priceMax,
    sort: SORTS.some((s) => s.value === first(sp.sort)) ? first(sp.sort)! : "recommended",
    page: parsePage(sp.page),
    pageSize: sizes.includes(Number(first(sp.pageSize))) ? Number(first(sp.pageSize)) : sizes[0],
  };
}

export type Parsed = ReturnType<typeof parseListingParams>;

export function toQuery(base: ProductQuery, p: Parsed): ProductQuery {
  return {
    ...base,
    brand: p.brands.length ? p.brands.join(",") : undefined,
    f: p.attrs.length ? p.attrs : undefined,
    inStock: p.inStock || undefined,
    onSale: p.onSale || base.onSale || undefined,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    sort: p.sort === "recommended" ? undefined : p.sort,
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
  if (next.sort !== "recommended") qs.set("sort", next.sort);
  if (next.pageSize !== listingPageSizes(basePath)[0]) qs.set("pageSize", String(next.pageSize));
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function listingIndexState(sp: SearchParams, path = "") {
  const parsed = parseListingParams(sp, path);
  return { page: parsed.page, filtered: hrefFor(path, {}, parsed, { page: 1 }) !== path };
}
