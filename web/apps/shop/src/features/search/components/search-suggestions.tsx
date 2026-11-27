"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { browserApi } from "@polivalko/shared/api/browser";
import type { ProductSearch } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@/shared/lib/images";
import { hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";

export function SearchSuggestions({ term, onSelect }: { term: string; onSelect: () => void }) {
  const [response, setResponse] = useState<{ term: string; data: ProductSearch | null } | null>(null);
  const result = response?.data;
  const pending = response?.term !== term;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await browserApi.GET("/api/v1/products", {
          params: { query: { q: term, pageSize: 5, includeFacets: false } },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!data) throw new Error();
        if (!controller.signal.aborted) setResponse({ term, data });
      } catch {
        if (!controller.signal.aborted) setResponse({ term, data: null });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  return <div id="header-search-results" className="header-search__results">
    <div role="status" className="header-search__status">
      {pending && !result?.items.length ? "Шукаємо товари…" : !result ? "Не вдалося завантажити підказки." :
        !result.items.length ? "Товарів не знайдено." : result.approximate ? "Схожі товари" :
        <span className="visually-hidden">Знайдено товарів: {result.totalItems}</span>}
    </div>
    {!!result?.items.length && <ul aria-label="Підказки пошуку" aria-busy={pending}>
      {result.items.map(product => <li key={product.id}>
        <Link href={`/product/${product.slug}`} prefetch={false} onClick={onSelect}>
          <span className="header-search__photo">{product.imageUrl && <img src={thumb(product.imageUrl)} alt="" width={40} height={40} />}</span>
          <span className="header-search__name">{product.name}</span>
          <span className="header-search__price">{hasPrice(product.price) ? formatMoney(product.price) : PRICE_ON_REQUEST}</span>
        </Link>
      </li>)}
    </ul>}
    <button type="submit" className="btn btn--graphite">Показати всі результати</button>
  </div>;
}
