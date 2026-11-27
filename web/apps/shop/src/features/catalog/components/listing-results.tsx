"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { browserApi } from "@polivalko/shared/api/browser";
import type { ProductSearch } from "@polivalko/shared/api/types";
import { countProducts } from "@polivalko/shared/lib/format";
import type { ProductQuery } from "../api/server";
import { useListingNavigation } from "./listing-navigation";
import { ListingToolbar } from "./listing-toolbar";
import { ProductTiles } from "./product-tiles";

type Batch = Pick<ProductSearch, "items" | "page" | "pageSize" | "totalItems" | "totalPages" | "approximate">;

export function ListingResults({ queryKey, initial, query, path, compact, children }: {
  queryKey: string;
  initial: Batch;
  query: ProductQuery;
  path: string;
  compact: boolean;
  children: ReactNode;
}) {
  const { pending } = useListingNavigation();
  const [trackedKey, setTrackedKey] = useState(queryKey);
  const [result, setResult] = useState(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  if (queryKey !== trackedKey) {
    setTrackedKey(queryKey);
    setResult(initial);
    setStatus("idle");
  }
  const request = useRef<AbortController | null>(null);
  const more = useRef<HTMLDivElement>(null);
  const hasMore = result.page < result.totalPages;
  const first = (initial.page - 1) * initial.pageSize + 1;

  async function loadMore() {
    if (pending || !hasMore || request.current) return;
    const page = result.page + 1;
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    try {
      const { data } = await browserApi.GET("/api/v1/products", {
        params: { query: { ...query, page, includeFacets: false } },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      if (controller.signal.aborted) {
        setStatus("idle");
        return;
      }
      if (!data || data.page !== page) throw new Error();
      const seen = new Set(result.items.map(product => product.id));
      const items = [...result.items, ...data.items.filter(product => !seen.has(product.id))];
      setResult({ ...data, items });
      setStatus("idle");
    } catch {
      setStatus(controller.signal.aborted ? "idle" : "error");
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  useEffect(() => () => request.current?.abort(), [queryKey]);
  const loadOnScroll = useEffectEvent(loadMore);
  useEffect(() => {
    if (!more.current || pending || !hasMore || status !== "idle" || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadOnScroll();
    }, { rootMargin: "0px 0px 320px" });
    observer.observe(more.current);
    return () => observer.disconnect();
  }, [pending, hasMore, status, result.page]);

  const summary = result.approximate
    ? `Точних збігів немає, ось схожі: ${countProducts(result.totalItems)}`
    : result.items.length
      ? `Показано ${first}-${first + result.items.length - 1} з ${result.totalItems.toLocaleString("uk-UA")}`
      : compact ? "" : "Товарів не знайдено";

  return (
    <div className="listing-stage" data-pending={pending ? "true" : undefined} aria-busy={pending}>
      <div className="listing-stage__progress" aria-hidden="true">
        <span className="listing-stage__progress-bar" />
      </div>
      <ListingToolbar summary={pending ? "Оновлюємо товари…" : summary} path={path} />
      <div className="listing-stage__body">
        {children}
        {result.items.length > 0 && <ProductTiles products={result.items} priority listing />}
        {hasMore && (
          <div ref={more} className="listing-more">
            {status === "error" && <p role="status">Не вдалося завантажити наступні товари.</p>}
            <button type="button" className="btn btn--quiet" disabled={status === "loading"} onClick={loadMore}>
              {status === "loading" ? "Завантажуємо товари…" : status === "error" ? "Спробувати ще раз" : "Показати ще"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
