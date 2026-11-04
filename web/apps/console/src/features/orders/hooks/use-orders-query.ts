"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Selection } from "@/shared/ui/selection";
import type { OrderStatus, PaymentStatus } from "@polivalko/shared/api/types";
import { FILTERS, type Filter, type Filters, type Sort } from "../lib/order-filters";

export function useOrdersQuery(selection: Selection) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as Filters;
  const page = Math.max(Number(params.get("page")) || 1, 1);

  const query = {
    q: f.q || undefined,
    status: (f.status || undefined) as OrderStatus | undefined,
    paymentStatus: (f.paymentStatus || undefined) as PaymentStatus | undefined,
    delivery: f.delivery || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    sort: (f.sort || undefined) as Sort | undefined,
  };
  const key = FILTERS.map((k) => f[k]).join("|");

  const go = (patch: Partial<Record<Filter | "page", string>>) => {
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
  const filtered = FILTERS.some((k) => k !== "sort" && f[k]);

  return { f, page, query, key, go, reset, filtered };
}
