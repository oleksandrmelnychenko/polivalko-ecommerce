"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Selection } from "@/shared/admin/ui/selection";
import { FILTERS, type ProductFilter, type ProductFilters } from "../lib/product-filters";

export function useProductsQuery(selection: Selection) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as ProductFilters;
  const page = Math.max(Number(params.get("page")) || 1, 1);

  const go = (patch: Partial<Record<ProductFilter | "page", string>>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    selection.clear();
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const reset = () => {
    selection.clear();
    router.replace(pathname, { scroll: false });
  };
  const filtered = FILTERS.some((k) => f[k]);

  return { f, page, go, reset, filtered };
}
