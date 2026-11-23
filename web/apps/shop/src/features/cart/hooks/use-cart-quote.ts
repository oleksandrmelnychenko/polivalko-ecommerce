"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { quoteCart } from "../api/client";
import { useCart } from "../components/cart-provider";

export function useCartQuote() {
  const { lines } = useCart();
  const [result, setResult] = useState<{ key: string; quote: Quote | null; pending: boolean } | null>(null);
  const latest = useRef<AbortController | null>(null);

  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const key = JSON.stringify(items);

  const refresh = useCallback(async () => {
    latest.current?.abort();
    if (items.length === 0) {
      setResult(null);
      return null;
    }
    const controller = new AbortController();
    latest.current = controller;
    setResult((previous) => previous && { ...previous, pending: true });
    let data: Quote | undefined;
    try {
      data = (await quoteCart(items, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))).data;
    } catch {
      data = undefined;
    }
    if (controller.signal.aborted) return null;
    setResult({ key, quote: data ?? null, pending: false });
    return data ?? null;
  }, [items, key]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 200);
    const timer = items.length ? window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000) : undefined;
    return () => {
      clearTimeout(t);
      window.clearInterval(timer);
      latest.current?.abort();
    };
  }, [items.length, refresh]);

  const matches = items.length > 0 && result?.key === key;
  const current = matches && !result.pending;
  return {
    items,
    quote: matches ? result.quote : null,
    deliveryQuote: items.length ? result?.quote ?? null : null,
    current,
    failed: current && !result.quote,
    refresh,
  };
}
