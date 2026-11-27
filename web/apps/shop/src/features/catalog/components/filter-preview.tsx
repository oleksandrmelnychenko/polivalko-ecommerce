"use client";

import { useEffect, useState } from "react";
import { browserApi } from "@polivalko/shared/api/browser";
import type { ProductListItem } from "@polivalko/shared/api/types";
import type { ProductQuery } from "../api/server";
import { toQuery, type Parsed } from "../lib/listing-params";
import { ProductTiles } from "./product-tiles";
import { ProductTilesSkeleton } from "./product-tiles-skeleton";

const FIRST_CARDS = 4;

export function FilterPreview({ base, selection }: { base: ProductQuery; selection: Parsed }) {
  const [items, setItems] = useState<ProductListItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const query = { ...toQuery(base, selection), page: 1, pageSize: FIRST_CARDS, includeFacets: false };
    // The route supplies the complete page even if this short request fails.
    browserApi.GET("/api/v1/products", { params: { query }, signal: controller.signal })
      .then(({ data }) => {
        if (data && !controller.signal.aborted) setItems(data.items);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [base, selection]);

  return items.length ? <ProductTiles products={items} priority /> : <ProductTilesSkeleton count={FIRST_CARDS} />;
}
